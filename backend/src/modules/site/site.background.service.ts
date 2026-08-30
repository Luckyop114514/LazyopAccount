import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { createReadStream, ReadStream } from 'fs';
import fs from 'fs-extra';
import path from 'path';
import { v4 } from 'uuid';
import { Site } from '@/entities/Site';
import { SiteBackground } from '@/entities/SiteBackground';
import { BackgroundImage, BackgroundSettings } from './site.interface';

// 上传目录，相对后端工作目录
export const BG_UPLOAD_DIR = path.resolve('uploads', 'background');
// 单张图片大小上限
export const BG_MAX_FILE_SIZE = 10 * 1024 * 1024;
// 单次最多上传张数
export const BG_MAX_FILE_COUNT = 5;

// 允许的图片类型。故意不含 svg：svg 可以携带脚本，同源加载会有 XSS 风险
const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
};

// 外链地址只允许 http(s) 或站内绝对路径，且不能包含会破坏 CSS url() 的字符
const URL_PATTERN = /^(https?:\/\/|\/)[^\s"'()\\]+$/;

// 背景图相关的站点配置项，存在 site 表里
const OPTIONS = {
  enabled: {
    name: 'bgEnabled',
    note: '全站背景图是否可见',
    default: 'false',
  },
  opacity: {
    name: 'bgOpacity',
    note: '全站背景图不透明度（0-100）',
    default: '25',
  },
  blur: {
    name: 'bgBlur',
    note: '全站背景图模糊半径（0-30 px）',
    default: '0',
  },
} as const;

@Injectable()
export class SiteBackgroundService {
  constructor(private readonly em: EntityManager) {}

  // 读取配置项，不存在时按默认值创建
  private async option(key: keyof BackgroundSettings) {
    const meta = OPTIONS[key];
    const row = await this.em.findOne(Site, { optionName: meta.name });
    if (row) return row;

    const created = new Site();
    created.optionName = meta.name;
    created.note = meta.note;
    created.value = meta.default;
    this.em.persist(created);
    await this.em.flush();
    return created;
  }

  private clamp(value: number, min: number, max: number, fallback: number) {
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, Math.round(value)));
  }

  // 全站显示设置
  async settings(): Promise<BackgroundSettings> {
    const enabled = await this.option('enabled');
    const opacity = await this.option('opacity');
    const blur = await this.option('blur');

    return {
      enabled: enabled.value === 'true',
      opacity: this.clamp(Number(opacity.value), 0, 100, 25),
      blur: this.clamp(Number(blur.value), 0, 30, 0),
    };
  }

  // 修改全站显示设置
  async updateSettings(body: BackgroundSettings) {
    const enabled = await this.option('enabled');
    const opacity = await this.option('opacity');
    const blur = await this.option('blur');

    enabled.value = body.enabled ? 'true' : 'false';
    opacity.value = String(this.clamp(body.opacity, 0, 100, 25));
    blur.value = String(this.clamp(body.blur, 0, 30, 0));
    await this.em.flush();

    return {
      msg: '保存成功',
      data: await this.settings(),
    };
  }

  private toImage(bg: SiteBackground): BackgroundImage {
    return {
      id: bg.id,
      type: bg.type,
      url: bg.type === 'url' ? bg.url ?? null : null,
      enabled: !!bg.enabled,
      mime: bg.mime,
      size: bg.size,
      uploader: bg.uploader,
      createdAt: bg.createdAt,
    };
  }

  // 管理端：显示设置 + 全部背景图
  async list() {
    const images = await this.em.find(
      SiteBackground,
      {},
      { orderBy: { id: 'DESC' } },
    );

    return {
      msg: '获取成功',
      data: {
        ...(await this.settings()),
        images: images.map((i) => this.toImage(i)),
      },
    };
  }

  // 公开接口：随机返回一张已启用的背景图
  async random() {
    const settings = await this.settings();
    const images = await this.em.find(SiteBackground, { enabled: true });
    const hit =
      images.length > 0
        ? images[Math.floor(Math.random() * images.length)]
        : null;

    return {
      msg: '获取成功',
      data: {
        ...settings,
        count: images.length,
        image: hit ? this.toImage(hit) : null,
      },
    };
  }

  // 通过外链地址添加
  async addUrls(urls: string[], uid: number) {
    const cleaned = Array.from(
      new Set(urls.map((u) => (u || '').trim()).filter((u) => u.length > 0)),
    );
    if (cleaned.length === 0) {
      throw new HttpException('请提供图片地址', HttpStatus.BAD_REQUEST);
    }

    const invalid = cleaned.find(
      (u) => u.length > 1000 || !URL_PATTERN.test(u),
    );
    if (invalid) {
      throw new HttpException(
        `图片地址不合法：${invalid}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    let added = 0;
    for (const url of cleaned) {
      const exists = await this.em.findOne(SiteBackground, { url });
      if (exists) continue;

      const bg = new SiteBackground();
      bg.type = 'url';
      bg.url = url;
      bg.uploader = uid;
      this.em.persist(bg);
      added++;
    }
    await this.em.flush();

    return {
      msg: added > 0 ? `已添加 ${added} 张背景图` : '这些地址都已经添加过了',
    };
  }

  // 上传本地图片
  async upload(files: Express.Multer.File[], uid: number) {
    if (!files || files.length === 0) {
      throw new HttpException('请选择要上传的图片', HttpStatus.BAD_REQUEST);
    }

    for (const file of files) {
      if (!ALLOWED_MIME[file.mimetype]) {
        throw new HttpException(
          `不支持的图片格式：${file.mimetype}`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    await fs.ensureDir(BG_UPLOAD_DIR);
    for (const file of files) {
      // 文件名一律重新生成，不使用上传时的原始名，避免路径穿越
      const filename = v4() + ALLOWED_MIME[file.mimetype];
      await fs.writeFile(path.join(BG_UPLOAD_DIR, filename), file.buffer);

      const bg = new SiteBackground();
      bg.type = 'file';
      bg.filename = filename;
      bg.mime = file.mimetype;
      bg.size = file.size;
      bg.uploader = uid;
      this.em.persist(bg);
    }
    await this.em.flush();

    return {
      msg: `已上传 ${files.length} 张背景图`,
    };
  }

  // 启用/停用单张
  async toggle(id: number, enabled: boolean) {
    const bg = await this.get(id);
    bg.enabled = enabled;
    await this.em.flush();

    return {
      msg: enabled ? '已启用' : '已停用',
    };
  }

  // 删除单张，同时清理本地文件
  async remove(id: number) {
    const bg = await this.get(id);
    if (bg.type === 'file' && bg.filename) {
      await fs.remove(path.join(BG_UPLOAD_DIR, path.basename(bg.filename)));
    }
    await this.em.removeAndFlush(bg);

    return {
      msg: '删除成功',
    };
  }

  // 读取本地图片文件
  async stream(id: number): Promise<{ stream: ReadStream; mime: string }> {
    const bg = await this.get(id);
    if (bg.type !== 'file' || !bg.filename) {
      throw new HttpException('该背景图不是本地文件', HttpStatus.BAD_REQUEST);
    }

    const file = path.join(BG_UPLOAD_DIR, path.basename(bg.filename));
    if (!(await fs.pathExists(file))) {
      throw new HttpException('背景图文件不存在', HttpStatus.NOT_FOUND);
    }

    return {
      stream: createReadStream(file),
      mime: bg.mime || 'application/octet-stream',
    };
  }

  private async get(id: number) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new HttpException('参数不合法', HttpStatus.BAD_REQUEST);
    }
    const bg = await this.em.findOne(SiteBackground, { id });
    if (!bg) {
      throw new HttpException('背景图不存在', HttpStatus.NOT_FOUND);
    }
    return bg;
  }
}