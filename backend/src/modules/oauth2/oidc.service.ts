import { Injectable, Logger } from '@nestjs/common';
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  createSign,
  generateKeyPairSync,
  KeyObject,
  timingSafeEqual,
} from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import config from '@/services/config';
import { PUBLIC_API_PREFIX } from '@/types/const';
import { User } from '@/entities/User';

// 私钥位置相对于后端进程的工作目录，和 config.json、uploads 同级
const KEY_DIR = 'keys';
const KEY_FILE = path.join(KEY_DIR, 'oidc-rsa.pem');

// id_token 有效期，短一点，客户端拿它只是为了认一次身份
const ID_TOKEN_TTL = 60 * 10;

const b64url = (input: string | Buffer) =>
  Buffer.from(input as any).toString('base64url');

@Injectable()
export class OidcService {
  private readonly privateKey: KeyObject;
  private readonly jwk: { kty: string; n: string; e: string };
  private readonly kid: string;

  constructor() {
    this.privateKey = createPrivateKey(OidcService.loadOrCreateKey());
    const pub = createPublicKey(this.privateKey).export({
      format: 'jwk',
    }) as Record<string, string>;
    this.jwk = { kty: pub.kty, n: pub.n, e: pub.e };
    // RFC 7638 的 JWK 指纹，字段顺序必须是 e、kty、n
    this.kid = createHash('sha256')
      .update(
        JSON.stringify({ e: this.jwk.e, kty: this.jwk.kty, n: this.jwk.n }),
      )
      .digest('base64url');
    Logger.log(`OIDC 签名密钥已就绪，kid=${this.kid}`);
  }

  /**
   * 签名私钥只在第一次启动时生成，之后一直复用。
   * 换了私钥，已经签发出去的 id_token 全部验签失败，所以不要删这个文件。
   */
  private static loadOrCreateKey() {
    if (fs.existsSync(KEY_FILE)) return fs.readFileSync(KEY_FILE, 'utf8');

    Logger.warn('未检测到 OIDC 签名私钥，正在生成...');
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
    fs.ensureDirSync(KEY_DIR);
    fs.writeFileSync(KEY_FILE, pem, { mode: 0o600 });
    return pem;
  }

  // 签发者，必须和发现文档所在的域名完全一致，否则客户端会报 issuer mismatch
  get issuer() {
    return (config.siteUrl || '').replace(/\/+$/, '');
  }

  get apiBase() {
    return `${this.issuer}/${PUBLIC_API_PREFIX}`;
  }

  jwks() {
    return {
      keys: [{ ...this.jwk, kid: this.kid, use: 'sig', alg: 'RS256' }],
    };
  }

  discovery() {
    return {
      issuer: this.issuer,
      // 授权端点是前端的授权确认页，用户在这里点“授权”
      authorization_endpoint: `${this.issuer}/oauth2/authorize`,
      token_endpoint: `${this.apiBase}/oauth2/token`,
      userinfo_endpoint: `${this.apiBase}/oauth2/userinfo`,
      jwks_uri: `${this.issuer}/.well-known/jwks.json`,
      scopes_supported: ['openid', 'profile', 'email'],
      response_types_supported: ['code'],
      response_modes_supported: ['query'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      token_endpoint_auth_methods_supported: [
        'client_secret_post',
        'client_secret_basic',
      ],
      code_challenge_methods_supported: ['S256', 'plain'],
      claims_supported: [
        'iss',
        'sub',
        'aud',
        'exp',
        'iat',
        'auth_time',
        'nonce',
        'at_hash',
        'name',
        'preferred_username',
        'nickname',
        'picture',
        'email',
        'email_verified',
        'updated_at',
      ],
    };
  }

  // 手搓 RS256，避免为了一个 JWT 再引一个依赖
  private sign(payload: Record<string, any>) {
    const header = { alg: 'RS256', typ: 'JWT', kid: this.kid };
    const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
    const sig = createSign('RSA-SHA256').update(data).sign(this.privateKey);
    return `${data}.${sig.toString('base64url')}`;
  }

  // at_hash：access_token 的 sha256 取左半边再 base64url
  private accessTokenHash(accessToken: string) {
    const digest = createHash('sha256').update(accessToken).digest();
    return b64url(digest.subarray(0, digest.length / 2));
  }

  /**
   * 把 scope 字符串拆开。只申请了 openid 的客户端也给全量 claims，
   * 免得一些没写全 scope 的客户端拿不到邮箱直接登录失败。
   */
  static parseScopes(scope?: string | null) {
    return (scope || '')
      .split(/[\s+]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  userClaims(user: User, scope?: string | null) {
    const scopes = OidcService.parseScopes(scope);
    const explicit = scopes.includes('profile') || scopes.includes('email');
    const claims: Record<string, any> = { sub: String(user.id) };

    if (!explicit || scopes.includes('profile')) {
      claims.name = user.username;
      claims.preferred_username = user.username;
      claims.nickname = user.username;
      claims.picture = this.pictureUrl(user);
      const reg = user.regTime ? new Date(user.regTime) : null;
      if (reg && !isNaN(reg.getTime()))
        claims.updated_at = Math.floor(reg.getTime() / 1000);
    }

    if (!explicit || scopes.includes('email')) {
      claims.email = user.email;
      // 本站注册、改邮箱都要过邮件验证码，能存进库就是验证过的
      claims.email_verified = true;
    }

    return claims;
  }

  // 有自定义头像走本站接口，否则回落到 Gravatar 反代，和前端逻辑保持一致
  private pictureUrl(user: User) {
    if (user.avatar)
      return `${this.apiBase}/user/avatar/file/${user.id}?v_=${user.avatar}`;
    const hash = createHash('md5')
      .update((user.email || '').trim().toLowerCase())
      .digest('hex');
    return `${this.issuer}/avatar/${hash}?s=300&r=R&d=`;
  }

  idToken(opts: {
    user: User;
    clientId: number;
    accessToken: string;
    scope?: string | null;
    nonce?: string | null;
    authTime?: number;
  }) {
    const now = Math.floor(Date.now() / 1000);
    const payload: Record<string, any> = {
      ...this.userClaims(opts.user, opts.scope),
      iss: this.issuer,
      aud: String(opts.clientId),
      iat: now,
      exp: now + ID_TOKEN_TTL,
      auth_time: opts.authTime ?? now,
      at_hash: this.accessTokenHash(opts.accessToken),
    };
    if (opts.nonce) payload.nonce = opts.nonce;

    return this.sign(payload);
  }

  // PKCE 校验，S256 比对哈希，plain 直接比字符串
  static verifyPkce(
    challenge: string,
    method: string | null | undefined,
    verifier: string,
  ) {
    const expected =
      (method || 'plain').toUpperCase() === 'S256'
        ? b64url(createHash('sha256').update(verifier).digest())
        : verifier;
    const a = Buffer.from(expected);
    const b = Buffer.from(challenge);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}