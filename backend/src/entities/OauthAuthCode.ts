import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'oauth_auth_codes' })
export class OauthAuthCode {
  @PrimaryKey({ length: 100 })
  id!: string;

  @Property({ fieldName: 'userId' })
  userId!: number;

  @Property({ nullable: true, fieldName: 'clientId' })
  clientId?: number;

  @Property({ type: 'text', nullable: true })
  scopes?: string;

  // OIDC：原样带回 id_token 的 nonce，用于客户端防重放
  @Property({ length: 255, nullable: true })
  nonce?: string | null;

  // PKCE：授权请求里的 code_challenge，换 token 时用 code_verifier 校验
  @Property({ length: 255, nullable: true, fieldName: 'codeChallenge' })
  codeChallenge?: string | null;

  @Property({ length: 10, nullable: true, fieldName: 'codeChallengeMethod' })
  codeChallengeMethod?: string | null;

  @Property({ nullable: true, fieldName: 'expiredAt' })
  expiredAt?: Date;
}