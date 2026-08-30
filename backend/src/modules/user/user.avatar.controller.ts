import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Res,
  Session,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
// 用 node 内置的 ServerResponse 而不是 express 的 Response：
// emitDecoratorMetadata 会把参数类型编译成运行时引用，导入 express 会让 webpack 打包失败
import { ServerResponse } from 'http';
import { CheckAuthGuard } from 'src/guards/permission';
import {
  AVATAR_MAX_FILE_SIZE,
  UserAvatarService as UserAvatarServices,
} from './user.avatar.service';

// 自定义头像。这里不加类级别的 CheckAuthGuard：
// 头像本身是公开信息（原本走的就是 Gravatar），未登录也要能显示，写入类接口单独加守卫
@Controller('user/avatar')
export class UserAvatarController {
  constructor(readonly UserAvatarService: UserAvatarServices) {}

  // 公开：读取指定用户的自定义头像
  @Get('file/:uid')
  async file(
    @Param('uid', ParseIntPipe) uid: number,
    @Res() res: ServerResponse,
  ): Promise<void> {
    const { stream, mime } = await this.UserAvatarService.stream(uid);
    res.setHeader('Content-Type', mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    stream.pipe(res);
  }

  // 上传自定义头像
  @Post()
  @UseGuards(CheckAuthGuard)
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: AVATAR_MAX_FILE_SIZE, files: 1 },
    }),
  )
  upload(
    @Session() session: Record<string, any>,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.UserAvatarService.upload(file, session.uid);
  }

  // 恢复默认头像
  @Delete()
  @UseGuards(CheckAuthGuard)
  @HttpCode(200)
  remove(@Session() session: Record<string, any>) {
    return this.UserAvatarService.remove(session.uid);
  }
}