export interface SiteOptions {
  id: number;
  note: string;
  optionName: string;
  value: string;
  updatedAt: Date;
}

// 背景图的全站显示设置
export interface BackgroundSettings {
  // 是否可见
  enabled: boolean;
  // 不透明度，0-100
  opacity: number;
  // 模糊半径，0-30 px
  blur: number;
}

// 给前端的单张背景图信息
export interface BackgroundImage {
  id: number;
  type: 'url' | 'file';
  // type 为 file 时为 null，由前端拼接 /site/background/file/:id
  url: string | null;
  enabled: boolean;
  mime?: string;
  size?: number;
  uploader?: number;
  createdAt?: Date;
}