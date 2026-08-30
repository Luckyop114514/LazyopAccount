import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Res,
  Session,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
// 用 node 内置的 ServerResponse 而不是 express 的 Response：
// emitDecoratorMetadata 会把参数类型编译成运行时引用，导入 express 会让 webpack 打包失败
import { ServerResponse } from 'http';
import { isAdmin } from 'src/guards/permission';
import {
  BG_MAX_FILE_COUNT,
  BG_MAX_FILE_SIZE,
  SiteBackgroundService,
} from './site.background.service';
import {
  AddBackgroundUrlDto,
  BackgroundSettingsDto,
  ToggleBackgroundDto,
} from './site.dto';

// 背景图接口。注意这里不加 CheckAuthGuard：
// 未登录的访客也要能看到背景图，所以读取类接口是公开的，写入类接口单独加 isAdmin
@Controller('site/background')
export class SiteBackgroundController {
  constructor(private readonly SiteBackgroundService: SiteBackgroundService) {}

  // 公开：获取显示设置，并随机返回一张已启用的背景图
  @Get()
  @HttpCode(200)
  random() {
    return this.SiteBackgroundService.random();
  }

  // 公开：读取本地上传的背景图文件
  @Get('file/:id')
  async file(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: ServerResponse,
  ): Promise<void> {
    const { stream, mime } = await this.SiteBackgroundService.stream(id);
    res.setHeader('Content-Type', mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=604800');
    stream.pipe(res);
  }

  // 管理员：显示设置 + 全部背景图
  @Get('list')
  @UseGuards(isAdmin)
  @HttpCode(200)
  list() {
    return this.SiteBackgroundService.list();
  }

  // 管理员：修改显示设置
  @Put('settings')
  @UseGuards(isAdmin)
  @HttpCode(200)
  updateSettings(@Body() body: BackgroundSettingsDto) {
    return this.SiteBackgroundService.updateSettings(body);
  }

  // 管理员：通过外链地址添加，支持一次多张
  @Post('url')
  @UseGuards(isAdmin)
  @HttpCode(200)
  addUrls(
    @Session() session: Record<string, any>,
    @Body() body: AddBackgroundUrlDto,
  ) {
    return this.SiteBackgroundService.addUrls(body.urls, session.uid);
  }

  // 管理员：上传图片，支持一次多张
  @Post('upload')
  @UseGuards(isAdmin)
  @HttpCode(200)
  @UseInterceptors(
    FilesInterceptor('files', BG_MAX_FILE_COUNT, {
      limits: { fileSize: BG_MAX_FILE_SIZE, files: BG_MAX_FILE_COUNT },
    }),
  )
  upload(
    @Session() session: Record<string, any>,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.SiteBackgroundService.upload(files, session.uid);
  }

  // 管理员：启用/停用单张
  @Patch(':id')
  @UseGuards(isAdmin)
  @HttpCode(200)
  toggle(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ToggleBackgroundDto,
  ) {
    return this.SiteBackgroundService.toggle(id, body.enabled);
  }

  // 管理员：删除单张
  @Delete(':id')
  @UseGuards(isAdmin)
  @HttpCode(200)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.SiteBackgroundService.remove(id);
  }
}