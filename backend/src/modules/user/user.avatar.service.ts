import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { createReadStream, ReadStream } from 'fs';
import fs from 'fs-extra';
import path from 'path';
import { v4 } from 'uuid';
import { User } from 'src/entities/User';

// 上传目录，相对后端工作目录
export const AVATAR_UPLOAD_DIR = path.resolve('uploads', 'avatar');
// 单张头像大小上限
export const AVATAR_MAX_FILE_SIZE = 2 * 1024 * 1024;

// 允许的图片类型。故意不含 svg：svg 可以携带脚本，同源加载会有 XSS 风险
const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
};

// 反查表，读取时按扩展名给出 Content-Type，省掉一个数据库字段
const MIME_BY_EXT: Record<string, string> = Object.fromEntries(
  Object.entries(ALLOWED_MIME).map(([mime, ext]) => [ext, mime]),
);

@Injectable()
export class UserAvatarService {
  constructor(private readonly em: EntityManager) {}

  // 上传自定义头像，一个用户只保留一张
  async upload(file: Express.Multer.File, uid: number) {
    if (!file) {
      throw new HttpException('请选择要上传的图片', HttpStatus.BAD_REQUEST);
    }
    if (!ALLOWED_MIME[file.mimetype]) {
      throw new HttpException(
        `不支持的图片格式：${file.mimetype}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const user = await this.get(uid);
    const old = user.avatar;

    await fs.ensureDir(AVATAR_UPLOAD_DIR);
    // 文件名一律重新生成，不使用上传时的原始名，避免路径穿越
    const filename = v4() + ALLOWED_MIME[file.mimetype];
    await fs.writeFile(path.join(AVATAR_UPLOAD_DIR, filename), file.buffer);

    user.avatar = filename;
    await this.em.flush();

    // 写库成功之后再删旧文件，避免删完了库没更新，头像直接裂掉
    if (old) await this.removeFile(old);

    return {
      msg: '头像已更新',
      data: { avatar: filename },
    };
  }

  // 删除自定义头像，回落到 Gravatar
  async remove(uid: number) {
    const user = await this.get(uid);
    if (!user.avatar) {
      throw new HttpException(
        '当前用的就是默认头像',
        HttpStatus.BAD_REQUEST,
      );
    }

    const old = user.avatar;
    user.avatar = null;
    await this.em.flush();
    await this.removeFile(old);

    return {
      msg: '已恢复默认头像',
    };
  }

  // 读取头像文件
  async stream(uid: number): Promise<{ stream: ReadStream; mime: string }> {
    const user = await this.get(uid);
    if (!user.avatar) {
      throw new HttpException('该用户没有自定义头像', HttpStatus.NOT_FOUND);
    }

    const filename = path.basename(user.avatar);
    const file = path.join(AVATAR_UPLOAD_DIR, filename);
    if (!(await fs.pathExists(file))) {
      throw new HttpException('头像文件不存在', HttpStatus.NOT_FOUND);
    }

    return {
      stream: createReadStream(file),
      mime: MIME_BY_EXT[path.extname(filename)] || 'application/octet-stream',
    };
  }

  private async removeFile(filename: string) {
    await fs.remove(path.join(AVATAR_UPLOAD_DIR, path.basename(filename)));
  }

  private async get(uid: number) {
    if (!Number.isInteger(uid) || uid <= 0) {
      throw new HttpException('参数不合法', HttpStatus.BAD_REQUEST);
    }
    const user = await this.em.findOne(User, { id: uid });
    if (!user) {
      throw new HttpException('用户不存在', HttpStatus.NOT_FOUND);
    }
    return user;
  }
}