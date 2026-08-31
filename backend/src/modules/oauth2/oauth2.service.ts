import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import {
  EntityRepository,
  EntityManager,
  wrap,
  serialize,
} from '@mikro-orm/core';
import { escapeWildcards, randomString } from '@/utils';
import {
  OauthBodyDto,
  NewOauthClientDto,
  EditOauthClientDto,
  AdminEditOauthClientDto,
  OauthClientIdDto,
  AuthorizeDto,
} from './oauth2.dto';
import { OauthClient } from '@/entities/OauthClient';
import { OauthAuthCode } from '@/entities/OauthAuthCode';
import { OauthAccessToken } from '@/entities/OauthAccessToken';
import { OauthRefreshToken } from '@/entities/OauthRefreshToken';
import { User } from '@/entities/User';
import { OidcService } from './oidc.service';
import { OauthError } from './oauth2.error';

// access_token 7 天，refresh_token 30 天
const AT_TTL_DAYS = 7;
const RT_TTL_DAYS = 30;

@Injectable()
export class Oauth2Service {
  constructor(
    @InjectRepository(OauthClient)
    private readonly oauthClientRepository: EntityRepository<OauthClient>,
    @InjectRepository(OauthAuthCode)
    private readonly oauthAuthCodeRepository: EntityRepository<OauthAuthCode>,
    @InjectRepository(OauthAccessToken)
    private readonly oauthAccessTokenRepository: EntityRepository<OauthAccessToken>,
    @InjectRepository(OauthRefreshToken)
    private readonly oauthRefreshTokenRepository: EntityRepository<OauthRefreshToken>,
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    private readonly em: EntityManager,
    private readonly oidc: OidcService,
  ) {}

  // 老应用的 protocol 列可能是 null，统一按 oauth2 处理
  private static isOidc(protocol?: string | null) {
    return protocol === 'oidc';
  }

  // 获取应用信息
  async clientInfo(clientId: string, isInternal = false) {
    // 从数据库中查询
    const o = await this.oauthClientRepository.findOne({
      id: Number(clientId),
    });

    if (!o) throw new Error('客户端不存在');

    // 删除敏感信息
    if (!isInternal) {
      return {
        msg: '获取成功',
        data: {
          id: o.id,
          name: o.name,
          protocol: Oauth2Service.isOidc(o.protocol) ? 'oidc' : 'oauth2',
          createdAt: o.createdAt,
        },
      };
    }

    return {
      msg: '获取成功',
      data: serialize(o),
    };
  }

  // 生成授权 Code
  async authorize(session: Record<string, any>, query: AuthorizeDto) {
    const o = await this.oauthClientRepository.findOne({
      id: Number(query.client_id),
    });
    if (!o) throw new Error('客户端不存在');

    if (o.redirect !== query.redirect_uri)
      throw new HttpException('重定向Url不匹配', HttpStatus.EXPECTATION_FAILED);

    const scopes = OidcService.parseScopes(query.scope);

    // OIDC 的授权请求必须带 openid scope，否则拿不到 id_token，
    // 客户端会在回调阶段报错，不如在这里就拦住
    if (Oauth2Service.isOidc(o.protocol) && !scopes.includes('openid'))
      throw new HttpException(
        'OIDC 应用的 scope 必须包含 openid',
        HttpStatus.EXPECTATION_FAILED,
      );

    // 获取用户ID
    const u = await this.userRepository.findOne({ id: session['uid'] });
    if (!u) throw new Error('用户不存在');

    // 同一个用户对同一个应用只保留最新的一个 code
    await this.oauthAuthCodeRepository.nativeDelete({
      userId: u.id,
      clientId: o.id,
    });

    // 生成授权 Code
    const code = '0' + randomString(66).toLowerCase() + Date.now();

    try {
      const newCode = this.oauthAuthCodeRepository.create({
        id: code,
        userId: u.id,
        clientId: o.id,
        scopes: query.scope || null,
        nonce: query.nonce || null,
        codeChallenge: query.code_challenge || null,
        codeChallengeMethod: query.code_challenge
          ? query.code_challenge_method || 'plain'
          : null,
        expiredAt: new Date(Date.now() + 60 * 3000), //三分钟后过期
      });
      await this.em.persist(newCode).flush();
    } catch (e) {
      Logger.error(e);
      throw e;
    }

    // 返回授权code
    return {
      msg: '获取成功',
      data: {
        state: query.state,
        code,
      },
    };
  }

  /**
   * token 端点。按 OAuth 2.0 规范支持两种 grant：
   * authorization_code、refresh_token；出错时返回 { error, error_description }
   */
  async getToken(body: OauthBodyDto, authorization?: string) {
    const oc = await this.authClient(body, authorization);

    switch (body.grant_type) {
      case 'authorization_code':
        return await this.codeGrant(oc, body);
      case 'refresh_token':
        return await this.refreshGrant(oc, body);
      default:
        throw new OauthError(
          'unsupported_grant_type',
          `不支持的 grant_type: ${body.grant_type}`,
        );
    }
  }

  // 校验客户端身份，凭据可以放在 body(client_secret_post) 或 Basic 头(client_secret_basic)
  private async authClient(body: OauthBodyDto, authorization?: string) {
    let clientId = body.client_id;
    let clientSecret = body.client_secret;

    const [scheme, encoded] = (authorization || '').split(' ');
    if (!clientSecret && scheme?.toLowerCase() === 'basic' && encoded) {
      const raw = Buffer.from(encoded, 'base64').toString('utf8');
      const sep = raw.indexOf(':');
      if (sep > 0) {
        clientId = Number(decodeURIComponent(raw.slice(0, sep)));
        clientSecret = decodeURIComponent(raw.slice(sep + 1));
      }
    }

    if (!clientId || !clientSecret)
      throw new OauthError(
        'invalid_client',
        '缺少客户端凭据',
        HttpStatus.UNAUTHORIZED,
      );

    const oc = await this.oauthClientRepository.findOne({ id: clientId });
    if (!oc || oc.secret !== clientSecret)
      throw new OauthError(
        'invalid_client',
        '客户端ID或密钥错误',
        HttpStatus.UNAUTHORIZED,
      );

    return oc;
  }

  // 授权码换 token
  private async codeGrant(oc: OauthClient, body: OauthBodyDto) {
    if (!body.code) throw new OauthError('invalid_request', '缺少 code');

    // redirect_uri 在授权阶段用过就必须原样再传一次
    if (body.redirect_uri && oc.redirect !== body.redirect_uri)
      throw new OauthError('invalid_grant', '重定向 Url 地址错误');

    const ac = await this.oauthAuthCodeRepository.findOne({ id: body.code });
    if (!ac) throw new OauthError('invalid_grant', 'Code 不存在');

    // code 只能用一次，先删掉再继续，避免重放
    await this.oauthAuthCodeRepository.nativeDelete({ id: body.code });

    if (ac.clientId !== oc.id)
      throw new OauthError('invalid_grant', 'Code 不属于该客户端');

    if (new Date(ac.expiredAt) < new Date())
      throw new OauthError('invalid_grant', 'Code 已过期');

    // PKCE：授权时带了 code_challenge，换 token 就必须给出 code_verifier
    if (ac.codeChallenge) {
      if (!body.code_verifier)
        throw new OauthError('invalid_request', '缺少 code_verifier');
      if (
        !OidcService.verifyPkce(
          ac.codeChallenge,
          ac.codeChallengeMethod,
          body.code_verifier,
        )
      )
        throw new OauthError('invalid_grant', 'code_verifier 校验失败');
    }

    return await this.issueToken({
      client: oc,
      userId: ac.userId,
      scope: ac.scopes,
      nonce: ac.nonce,
    });
  }

  // 刷新 token，旧的 access_token / refresh_token 一并作废（轮换）
  private async refreshGrant(oc: OauthClient, body: OauthBodyDto) {
    if (!body.refresh_token)
      throw new OauthError('invalid_request', '缺少 refresh_token');

    const rt = await this.oauthRefreshTokenRepository.findOne({
      id: body.refresh_token,
    });
    if (!rt) throw new OauthError('invalid_grant', 'refresh_token 不存在');

    const act = await this.oauthAccessTokenRepository.findOne({
      id: rt.access_token_id,
    });

    if (new Date(rt.expiredAt) < new Date() || !act) {
      await this.oauthRefreshTokenRepository.nativeDelete({ id: rt.id });
      throw new OauthError('invalid_grant', 'refresh_token 已过期');
    }

    if (act.clientId !== oc.id)
      throw new OauthError('invalid_grant', 'refresh_token 不属于该客户端');

    const userId = act.userId;
    const scope = body.scope || act.scopes;

    await this.oauthRefreshTokenRepository.nativeDelete({ id: rt.id });
    await this.oauthAccessTokenRepository.nativeDelete({ id: act.id });

    return await this.issueToken({ client: oc, userId, scope });
  }

  // 落库并组装 token 响应，OIDC 应用额外签发 id_token
  private async issueToken(opts: {
    client: OauthClient;
    userId: number;
    scope?: string | null;
    nonce?: string | null;
  }) {
    const accessToken =
      'NYANCY_' + randomString(79).toLowerCase() + '_ACCESS_TOKEN';
    const refreshToken =
      'NYANCY_' + randomString(78).toLowerCase() + '_REFRESH_TOKEN';

    const now = new Date();
    const atExpiredAt = new Date(
      new Date().setDate(now.getDate() + AT_TTL_DAYS),
    );
    const rtExpiredAt = new Date(
      new Date().setDate(now.getDate() + RT_TTL_DAYS),
    );

    try {
      const newAccessToken = this.oauthAccessTokenRepository.create({
        id: accessToken,
        userId: opts.userId,
        clientId: opts.client.id,
        scopes: opts.scope || null,
        createdAt: now,
        updatedAt: now,
        expiredAt: atExpiredAt,
      });

      const newRefreshToken = this.oauthRefreshTokenRepository.create({
        id: refreshToken,
        access_token_id: accessToken,
        expiredAt: rtExpiredAt,
      });

      await this.em.persist([newAccessToken, newRefreshToken]).flush();
    } catch (e) {
      Logger.error(e);

      throw e;
    }

    const res: Record<string, any> = {
      access_token: accessToken,
      token_type: 'Bearer',
      refresh_token: refreshToken, // 30天
      expires_in: AT_TTL_DAYS * 24 * 60 * 60, // 7天
    };
    if (opts.scope) res.scope = opts.scope;

    if (Oauth2Service.isOidc(opts.client.protocol)) {
      const user = await this.userRepository.findOne({ id: opts.userId });
      if (!user) throw new OauthError('invalid_grant', '用户不存在');
      res.id_token = this.oidc.idToken({
        user,
        clientId: opts.client.id,
        accessToken,
        scope: opts.scope,
        nonce: opts.nonce,
      });
    }

    return res;
  }

  // 解析并校验 Bearer token，返回对应的 access_token 记录
  private async resolveBearer(authorization: string) {
    if (!authorization) throw new Error('Authorization Empty');
    // 检查 Authorization 头是否以 Bearer 开头
    const [bearer, accessToken] = authorization.split(' ');
    if (bearer !== 'Bearer' || !accessToken) {
      throw new Error('Authorization 格式错误');
    }

    // 检查 accessToken是否过期
    const act = await this.oauthAccessTokenRepository.findOne({
      id: accessToken,
    });

    if (!act)
      throw new HttpException(
        'access_token 已过期',
        HttpStatus.PRECONDITION_FAILED,
      );

    if (new Date(act.expiredAt) < new Date()) {
      // 过期了就删除
      await this.oauthAccessTokenRepository.nativeDelete({ id: accessToken });
      throw new HttpException(
        'access_token 已过期',
        HttpStatus.PRECONDITION_FAILED,
      );
    }

    return act;
  }

  // 返回用户信息（本站自有格式，老应用在用，不要改字段）
  async userInfo(session: Record<string, any>, authorization: string) {
    // todo: 检查Content-Type是不是application/x-www-form-urlencoded
    const act = await this.resolveBearer(authorization);

    // 获取用户信息
    const r = await this.userRepository.findOne({ id: act.userId });
    if (!r) throw new Error('用户不存在');

    const u = serialize(r);
    delete u.password;
    delete u.verifyToken;
    delete u.apikey;
    delete u.authDevice;
    return {
      msg: '获取成功',
      data: u,
    };
  }

  // OIDC 标准 userinfo，直接返回扁平的 claims，不套统一响应体
  async oidcUserInfo(authorization: string) {
    let act: OauthAccessToken;
    try {
      act = await this.resolveBearer(authorization);
    } catch {
      throw new OauthError(
        'invalid_token',
        'access_token 无效或已过期',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const user = await this.userRepository.findOne({ id: act.userId });
    if (!user)
      throw new OauthError(
        'invalid_token',
        '用户不存在',
        HttpStatus.UNAUTHORIZED,
      );

    return this.oidc.userClaims(user, act.scopes);
  }

  // OIDC 发现文档
  discovery() {
    return this.oidc.discovery();
  }

  // 签名公钥
  jwks() {
    return this.oidc.jwks();
  }

  /**
   * 个人用户
   */
  // 获取自己创建的oauth2应用
  async myClients(session: Record<string, any>) {
    // 根据id查找应用
    const c = await this.oauthClientRepository.find({ userId: session['uid'] });

    return {
      msg: '获取成功',
      // data: c.map((client) => wrap(client).toPOJO()),
      data: serialize(c),
    };
  }

  // 新建一个oauth2应用
  async createClient(session: Record<string, any>, body: NewOauthClientDto) {
    // 获取用户ID
    const uid = session['uid'];

    try {
      const newClient = this.oauthClientRepository.create({
        userId: uid,
        name: body.name,
        secret: randomString(40),
        redirect: body.redirect,
        protocol: body.protocol || 'oauth2',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await this.em.persist(newClient).flush();
    } catch (e) {
      throw e;
    }

    return {
      msg: '添加成功',
    };
  }

  // 编辑自己的oauth2应用
  async editMyClient(session: Record<string, any>, body: EditOauthClientDto) {
    // 获取用户ID
    const uid = session['uid'];

    // 检查body的id是否为该用户所拥有的
    const client = await this.oauthClientRepository.findOne({ id: body.id });

    if (!client) throw new Error('应用不存在');
    if (client.userId !== uid) throw new Error('你无权修改该应用');

    client.name = body.name;
    client.redirect = body.redirect;
    client.protocol = body.protocol || 'oauth2';
    client.updatedAt = new Date();

    await this.em.flush();

    return {
      msg: '更新成功',
    };
  }

  // 删除自己的oauth2应用
  async delMyClient(session: Record<string, any>, body: OauthClientIdDto) {
    // 获取用户ID
    const uid = session['uid'];

    // 检查body的id是否为该用户所拥有的
    const client = await this.oauthClientRepository.findOne({ id: body.id });

    if (!client) throw new Error('应用不存在');
    if (client.userId !== uid) throw new Error('你无权删除该应用');

    await this.oauthClientRepository.nativeDelete({ id: body.id });

    return {
      msg: '删除成功',
    };
  }

  /**
   * 管理员接口
   */
  // 获取所有oauth2应用
  async allClients(
    page: number,
    pageSize: number,
    sortBy: keyof OauthClient,
    sortDesc?: boolean,
    search?: string,
  ) {
    if (pageSize == -1) {
      const [clients, count] = await this.oauthClientRepository.findAndCount(
        {},
      );
      return {
        msg: '获取成功',
        data: {
          totalCount: count,
          totalPages: 1,
          users: clients.map((client) => wrap(client).toPOJO()),
        },
      };
    }

    // 排序方式
    const orderBy = { [sortBy || 'id']: sortDesc ? 'DESC' : 'ASC' };

    // 构建搜索条件
    const where: any = {};
    if (search) {
      const escapedSearch = escapeWildcards(search);
      where.$or = [
        { name: { $like: `%${escapedSearch}%` } },
        { secret: { $like: `%${escapedSearch}%` } },
        { redirect: { $like: `%${escapedSearch}%` } },
        { protocol: { $like: `%${escapedSearch}%` } },
      ];

      // 如果搜索内容是数字，添加id和userId搜索
      if (!isNaN(Number(search))) {
        where.$or.push({ id: Number(search) });
        where.$or.push({ userId: Number(search) });
      }
    }

    const [clients, totalCount] = await this.oauthClientRepository.findAndCount(
      where,
      {
        orderBy: orderBy as any,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      },
    );

    const totalPages = Math.ceil(totalCount / pageSize);

    if (totalPages !== 0 && page > totalPages) throw new Error('超出页数');

    return {
      msg: '获取成功',
      data: {
        totalCount: totalCount,
        totalPages: totalPages,
        clients: clients.map((client) => wrap(client).toPOJO()),
      },
    };
  }

  // 编辑指定oauth2应用
  async editClient(body: AdminEditOauthClientDto) {
    const client = await this.oauthClientRepository.findOne({ id: body.id });
    if (!client) throw new Error('应用不存在');

    client.userId = body.userId;
    client.name = body.name;
    client.secret = body.secret;
    client.redirect = body.redirect;
    client.protocol = body.protocol || 'oauth2';
    client.updatedAt = new Date();

    await this.em.flush();

    return {
      msg: '更新成功',
    };
  }

  // 删除指定的oauth2应用
  async deleteClient(body: OauthClientIdDto) {
    await this.oauthClientRepository.nativeDelete({ id: body.id });

    return {
      msg: '删除成功',
    };
  }

  // 重置客户端密钥
  async resetSecret(session: Record<string, any>, id: number) {
    // 获取用户ID
    const uid = session['uid'];

    // 检查id是否为该用户所拥有的
    const client = await this.oauthClientRepository.findOne({ id });

    if (!client) throw new Error('应用不存在');
    if (client.userId !== uid) throw new Error('你无权修改该应用');

    client.secret = randomString(40);
    await this.em.flush();

    return {
      msg: '更新成功',
    };
  }
}