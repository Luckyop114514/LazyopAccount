import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { SiteController } from './site.controller';
import { SiteService } from './site.service';
import { SiteBackgroundController } from './site.background.controller';
import { SiteBackgroundService } from './site.background.service';
import { AuthService } from '@/modules/auth/auth.service';
import { Site } from '@/entities/Site';
import { SiteBackground } from '@/entities/SiteBackground';
import { User } from '@/entities/User';
import { OauthClient } from '@/entities/OauthClient';
import { DailyStatistic } from '@/entities/DailyStatistic';

@Module({
  imports: [
    MikroOrmModule.forFeature([
      Site,
      SiteBackground,
      User,
      OauthClient,
      DailyStatistic,
    ]),
  ],
  controllers: [SiteBackgroundController, SiteController],
  providers: [SiteService, SiteBackgroundService, AuthService],
})
export class SiteModule {}