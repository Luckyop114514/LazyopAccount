import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsString,
  Max,
  Min,
} from 'class-validator';

// 通过外链地址添加背景图
export class AddBackgroundUrlDto {
  @IsArray({ message: '请提供图片地址' })
  @ArrayNotEmpty({ message: '请提供图片地址' })
  @ArrayMaxSize(50, { message: '一次最多添加 50 个地址' })
  @IsString({ each: true, message: '图片地址必须是字符串' })
  urls: string[];
}

// 修改背景图显示设置
export class BackgroundSettingsDto {
  @IsBoolean({ message: '可见状态必须是布尔值' })
  enabled: boolean;

  @Type(() => Number)
  @IsInt({ message: '不透明度必须是整数' })
  @Min(0, { message: '不透明度不能小于 0' })
  @Max(100, { message: '不透明度不能大于 100' })
  opacity: number;

  @Type(() => Number)
  @IsInt({ message: '模糊半径必须是整数' })
  @Min(0, { message: '模糊半径不能小于 0' })
  @Max(30, { message: '模糊半径不能大于 30' })
  blur: number;
}

// 单张背景图的启用/停用
export class ToggleBackgroundDto {
  @IsBoolean({ message: '启用状态必须是布尔值' })
  enabled: boolean;
}