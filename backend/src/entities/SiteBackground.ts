import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

export type SiteBackgroundType = 'url' | 'file';

@Entity({ tableName: 'site_background' })
export class SiteBackground {
  @PrimaryKey()
  id!: number;

  // url：外链图片；file：上传到本地 uploads/background 的图片
  @Property({ length: 10, default: 'url' })
  type: SiteBackgroundType = 'url';

  // type 为 url 时保存完整地址
  @Property({ type: 'text', nullable: true })
  url?: string;

  // type 为 file 时保存 uploads/background 下的文件名
  @Property({ nullable: true })
  filename?: string;

  @Property({ length: 100, nullable: true })
  mime?: string;

  @Property({ default: 0 })
  size?: number = 0;

  @Property({ default: true })
  enabled?: boolean = true;

  // 上传者 uid
  @Property({ nullable: true })
  uploader?: number;

  @Property({ nullable: true, fieldName: 'createdAt' })
  createdAt?: Date = new Date();
}