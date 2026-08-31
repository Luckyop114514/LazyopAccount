import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Oauth2Controller } from './oauth2.controller';
import { Oauth2Service } from './oauth2.service';
import { OidcService } from './oidc.service';
import { OauthClient } from '@/entities/OauthClient';
import { OauthAuthCode } from '@/entities/OauthAuthCode';
import { OauthAccessToken } from '@/entities/OauthAccessToken';
import { OauthRefreshToken } from '@/entities/OauthRefreshToken';
import { User } from '@/entities/User';

@Module({
  imports: [
    MikroOrmModule.forFeature([
      OauthClient,
      OauthAuthCode,
      OauthAccessToken,
      OauthRefreshToken,
      User,
    ]),
  ],
  controllers: [Oauth2Controller],
  providers: [Oauth2Service, OidcService],
})
export class Oauth2Module {}