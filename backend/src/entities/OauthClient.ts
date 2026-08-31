import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

// 应用使用的协议：oauth2 只发 access_token，oidc 会额外签发 id_token
export const OAUTH_PROTOCOLS = ['oauth2', 'oidc'] as const;
export type OauthProtocol = (typeof OAUTH_PROTOCOLS)[number];

@Entity({ tableName: 'oauth_clients' })
export class OauthClient {
  @PrimaryKey()
  id!: number;

  @Property({ nullable: true, fieldName: 'userId' })
  userId?: number;

  @Property({ default: '' })
  name!: string;

  @Property({ length: 100, default: '' })
  secret!: string;

  @Property({ type: 'text' })
  redirect!: string;

  // 老数据没有这一列的值，读出来会是 null，一律按 oauth2 处理
  @Property({ length: 10, default: 'oauth2' })
  protocol!: string;

  @Property({ nullable: true, fieldName: 'createdAt' })
  createdAt?: Date;

  @Property({ nullable: true, fieldName: 'updatedAt' })
  updatedAt?: Date;
}