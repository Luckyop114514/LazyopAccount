import { ERR_UNSUPPORTED_DATA_TYPE } from '@/types/const';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsIn,
  MaxLength,
  Max,
  IsBoolean,
} from 'class-validator';
import { OauthClient, OAUTH_PROTOCOLS } from '@/entities/OauthClient';
import { IntersectionType } from '@nestjs/mapped-types';

export class OauthBodyDto {
  @IsNotEmpty({ message: ERR_UNSUPPORTED_DATA_TYPE })
  @IsString({ message: ERR_UNSUPPORTED_DATA_TYPE })
  grant_type: string;

  // 客户端凭据也允许放在 Authorization: Basic 里（client_secret_basic），
  // 所以这里全部改成可选，具体校验交给 service
  @IsOptional()
  @IsInt({ message: ERR_UNSUPPORTED_DATA_TYPE })
  @Type(() => Number)
  client_id?: number;

  @IsOptional()
  @IsString({ message: ERR_UNSUPPORTED_DATA_TYPE })
  client_secret?: string;

  @IsOptional()
  @IsString({ message: ERR_UNSUPPORTED_DATA_TYPE })
  redirect_uri?: string;

  @IsOptional()
  @IsString({ message: ERR_UNSUPPORTED_DATA_TYPE })
  code?: string;

  // grant_type=refresh_token 时使用
  @IsOptional()
  @IsString({ message: ERR_UNSUPPORTED_DATA_TYPE })
  refresh_token?: string;

  // PKCE
  @IsOptional()
  @IsString({ message: ERR_UNSUPPORTED_DATA_TYPE })
  code_verifier?: string;

  @IsOptional()
  @IsString({ message: ERR_UNSUPPORTED_DATA_TYPE })
  scope?: string;
}

export class OauthClientIdDto {
  @IsNotEmpty({ message: 'ID 不能为空' })
  // TODO: 动态限制个数
  @Max(999999999, { message: 'ID 过长！' })
  @IsInt({ message: ERR_UNSUPPORTED_DATA_TYPE })
  id: number;
}

export class NewOauthClientDto {
  @IsNotEmpty({ message: '请填写应用名' })
  @MaxLength(32, { message: '应用名过长！' })
  @IsString({ message: ERR_UNSUPPORTED_DATA_TYPE })
  name: string;

  @IsNotEmpty({ message: '请填写回调地址' })
  @MaxLength(2333, { message: '回调地址过长！' })
  @IsString({ message: ERR_UNSUPPORTED_DATA_TYPE })
  redirect: string;

  // 不传就按 oauth2 走，保持和老客户端一致
  @IsOptional()
  @IsIn(OAUTH_PROTOCOLS as unknown as string[], {
    message: '不支持的协议类型',
  })
  protocol?: string;
}

export class EditOauthClientDto extends IntersectionType(
  OauthClientIdDto,
  NewOauthClientDto,
) {}

export class AdminEditOauthClientDto extends EditOauthClientDto {
  @IsNotEmpty({ message: '请填写客户端密钥' })
  @IsString({ message: ERR_UNSUPPORTED_DATA_TYPE })
  secret: string;

  @IsNotEmpty({ message: '请填写所属用户ID' })
  @IsInt({ message: ERR_UNSUPPORTED_DATA_TYPE })
  userId: number;
}

export class AuthorizeDto {
  @IsNotEmpty({ message: '请填写客户端ID' })
  @IsString({ message: ERR_UNSUPPORTED_DATA_TYPE })
  client_id: string;

  @IsNotEmpty({ message: '请填写回调地址' })
  @IsString({ message: ERR_UNSUPPORTED_DATA_TYPE })
  redirect_uri: string;

  @IsNotEmpty({ message: '不支持的响应类型' })
  @IsString({
    message: ERR_UNSUPPORTED_DATA_TYPE,
  })
  @IsIn(['code'], { message: '不支持的响应类型' })
  response_type: string;

  // TODO: test 允许为空，但如果有值则必须是字符串
  @IsOptional()
  @IsString({ message: ERR_UNSUPPORTED_DATA_TYPE })
  scope: string;

  @IsOptional()
  @IsString({ message: ERR_UNSUPPORTED_DATA_TYPE })
  state: string;

  // OIDC：会原样写进 id_token
  @IsOptional()
  @MaxLength(255, { message: 'nonce 过长！' })
  @IsString({ message: ERR_UNSUPPORTED_DATA_TYPE })
  nonce?: string;

  // PKCE
  @IsOptional()
  @MaxLength(255, { message: 'code_challenge 过长！' })
  @IsString({ message: ERR_UNSUPPORTED_DATA_TYPE })
  code_challenge?: string;

  @IsOptional()
  @IsIn(['S256', 'plain'], { message: '不支持的 code_challenge_method' })
  code_challenge_method?: string;
}

export class GetClientsDto {
  @IsNotEmpty()
  @IsInt({ message: ERR_UNSUPPORTED_DATA_TYPE })
  @Type(() => Number)
  page: number = 1;

  @IsNotEmpty()
  @IsInt({ message: ERR_UNSUPPORTED_DATA_TYPE })
  @Type(() => Number)
  pageSize: number = 10;

  @IsOptional()
  @IsIn([
    'id',
    'userId',
    'name',
    'secret',
    'redirect',
    'protocol',
    'createdAt',
    'updatedAt',
  ])
  sortBy?: keyof OauthClient;

  @IsOptional()
  @IsBoolean({ message: ERR_UNSUPPORTED_DATA_TYPE })
  @Transform(({ value }) => value === true || value === 'true')
  sortDesc: boolean = false;

  @IsOptional()
  @IsString({ message: ERR_UNSUPPORTED_DATA_TYPE })
  search?: string;
}