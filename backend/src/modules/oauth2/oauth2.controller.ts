import {
  Controller,
  HttpCode,
  UseGuards,
  Headers,
  Header,
  Session,
  Query,
  Param,
  Put,
  Post,
  Body,
  Get,
  Delete,
  Options,
  ParseIntPipe,
} from '@nestjs/common';
import { Oauth2Service as Oauth2Services } from './oauth2.service';
import { CheckAuthGuard, isAdmin } from 'src/guards/permission';
import {
  OauthBodyDto,
  NewOauthClientDto,
  OauthClientIdDto,
  AdminEditOauthClientDto,
  AuthorizeDto,
  GetClientsDto,
  EditOauthClientDto,
} from './oauth2.dto';

@Controller('oauth2')
export class Oauth2Controller {
  constructor(private readonly Oauth2Service: Oauth2Services) {}

  /**
   * OIDC 发现文档与签名公钥。
   * 标准要求它们挂在 issuer 根路径上，nginx 会把
   * /.well-known/openid-configuration 和 /.well-known/jwks.json 转发到这里
   */
  @Get('.well-known/openid-configuration')
  @HttpCode(200)
  discovery() {
    return this.Oauth2Service.discovery();
  }

  @Get('jwks.json')
  @HttpCode(200)
  jwks() {
    return this.Oauth2Service.jwks();
  }

  // 获取应用信息（用于前端信息展示）
  @Get('client/:client_id')
  @UseGuards(CheckAuthGuard)
  @HttpCode(200)
  async clientInfo(@Param('client_id') clientId: string) {
    return await this.Oauth2Service.clientInfo(clientId);
  }

  // 生成授权 Code
  @Post('authorize')
  @UseGuards(CheckAuthGuard)
  @HttpCode(200)
  async authorize(
    @Session() session: Record<string, any>,
    @Query() query: AuthorizeDto,
  ) {
    return await this.Oauth2Service.authorize(session, query);
  }

  // 验证 Code，返回授权 Token
  @Options('token')
  @HttpCode(200)
  tokenPreflight() {
    return { msg: 'ok' };
  }

  @Post('token')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  async getToken(
    @Body() body: OauthBodyDto,
    @Headers('authorization') authorization: string,
  ) {
    return await this.Oauth2Service.getToken(body, authorization);
  }

  // 根据 Token 查询用户信息
  @Options('user')
  @HttpCode(200)
  return200() {
    return {
      msg: 'ok',
    };
  }

  @Get('user')
  @HttpCode(200)
  async getUserInfo(
    @Session() session: Record<string, any>,
    @Headers('authorization') authorization: string,
    // @Body() body: OauthBodyDto,
  ) {
    return await this.Oauth2Service.userInfo(session, authorization);
  }

  /**
   * OIDC 标准 userinfo，返回扁平的 claims。
   * 规范要求同时支持 GET 和 POST
   */
  @Options('userinfo')
  @HttpCode(200)
  userinfoPreflight() {
    return { msg: 'ok' };
  }

  @Get('userinfo')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async oidcUserInfo(@Headers('authorization') authorization: string) {
    return await this.Oauth2Service.oidcUserInfo(authorization);
  }

  @Post('userinfo')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async oidcUserInfoPost(@Headers('authorization') authorization: string) {
    return await this.Oauth2Service.oidcUserInfo(authorization);
  }

  /**
   * 个人用户
   */
  // 获取自己创建的oauth2应用
  @Get('user/clients')
  @UseGuards(CheckAuthGuard)
  @HttpCode(200)
  async userClients(@Session() session: Record<string, any>) {
    return await this.Oauth2Service.myClients(session);
  }

  // 新建一个oauth2应用
  @Post('user/client')
  @UseGuards(CheckAuthGuard)
  @HttpCode(200)
  async createClient(
    @Session() session: Record<string, any>,
    @Body() body: NewOauthClientDto,
  ) {
    return await this.Oauth2Service.createClient(session, body);
  }

  // 编辑oauth2应用
  @Put('user/client')
  @UseGuards(CheckAuthGuard)
  @HttpCode(200)
  async editClient(
    @Session() session: Record<string, any>,
    @Body() body: EditOauthClientDto,
  ) {
    return await this.Oauth2Service.editMyClient(session, body);
  }

  // 删除oauth2应用
  @Delete('user/client')
  @UseGuards(CheckAuthGuard)
  @HttpCode(200)
  async delClient(
    @Session() session: Record<string, any>,
    @Body() body: OauthClientIdDto,
  ) {
    return await this.Oauth2Service.delMyClient(session, body);
  }

  // 重置oauth2应用密钥
  @Put('user/client/reset/:id')
  @UseGuards(CheckAuthGuard)
  @HttpCode(200)
  async resetKey(
    @Session() session: Record<string, any>,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return await this.Oauth2Service.resetSecret(session, id);
  }

  /**
   * 管理员接口
   */
  // 查看所有oauth2应用
  @Get('admin/clients')
  @UseGuards(CheckAuthGuard)
  @UseGuards(isAdmin)
  @HttpCode(200)
  async clients(@Query() query: GetClientsDto) {
    return await this.Oauth2Service.allClients(
      query.page,
      query.pageSize,
      query.sortBy,
      query.sortDesc,
      query.search,
    );
  }

  // 编辑指定oauth2应用
  @Put('admin/client')
  @UseGuards(CheckAuthGuard)
  @UseGuards(isAdmin)
  @HttpCode(200)
  async _editClient(@Body() body: AdminEditOauthClientDto) {
    return await this.Oauth2Service.editClient(body);
  }

  // 删除指定oauth2应用
  @Delete('admin/client')
  @UseGuards(CheckAuthGuard)
  @UseGuards(isAdmin)
  @HttpCode(200)
  async _delClient(@Body() body: OauthClientIdDto) {
    return await this.Oauth2Service.deleteClient(body);
  }
}