import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { Site } from 'src/entities/Site';
import { User } from 'src/entities/User';
import { OauthClient } from '@/entities/OauthClient';
import { DailyStatistic } from 'src/entities/DailyStatistic';
import { SiteOptions } from './site.interface';

@Injectable()
export class SiteService {
  constructor(private readonly em: EntityManager) {}

  // 获取所有站点配置
  async options() {
    const r = await this.em.find(Site, {});
    return {
      msg: '获取成功',
      data: r,
    };
  }

  // 更新配置信息
  async update_(body: SiteOptions) {
    // 更新数据
    const site = await this.em.findOne(Site, { id: body.id });
    if (!site) {
      throw new Error('发生了未知错误，请联系网站管理员');
    }

    site.note = body.note;
    site.value = body.value;
    // updatedAt will be updated automatically by onUpdate hook in entity

    await this.em.flush();

    return {
      msg: '更新成功',
    };
  }

  // daily_statistics 里的日期可能是 Date 也可能是字符串，统一成 YYYY-MM-DD
  private toDateKey(date: string | Date) {
    return date instanceof Date
      ? date.toISOString().split('T')[0]
      : String(date).split('T')[0];
  }

  // 获取统计数据
  async getStatistic() {
    const oauthClientsCount = await this.em.count(OauthClient);
    const userCount = await this.em.count(User);

    // 最近 7 天（含今天）。注册时按 UTC 日期入库，这里也按 UTC 取，保持一致
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      days.push(this.toDateKey(d));
    }

    const dS = await this.em.find(DailyStatistic, {
      date: { $gte: days[0] },
    });

    const counts = new Map<string, number>();
    for (const entry of dS) {
      counts.set(this.toDateKey(entry.date), entry.count || 0);
    }

    // 没有注册的日期补 0，否则只有一天有数据时前端画不出折线
    const dailyRegStatistics = days.reduce(
      (acc, day) => {
        const [, month, date] = day.split('-');
        acc.date.push(`${Number(month)}/${Number(date)}`);
        acc.count.push(counts.get(day) || 0);
        return acc;
      },
      { date: [], count: [] } as { date: string[]; count: number[] },
    );

    const statistics = {
      oauth_clients: oauthClientsCount.toString(),
      user: userCount.toString(),
      dailyRegStatistics,
    };

    return {
      msg: '获取成功',
      data: statistics,
    };
  }
}
