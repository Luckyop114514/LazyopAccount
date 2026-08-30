import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserAdminController } from './user.admin.controller';
import { UserAdminService } from './user.admin.service';
import { UserAvatarController } from './user.avatar.controller';
import { UserAvatarService } from './user.avatar.service';
import { AuthService } from 'src/modules/auth/auth.service';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { User } from 'src/entities/User';
import { UserIp } from 'src/entities/UserIp';

@Module({
  imports: [MikroOrmModule.forFeature([User, UserIp])],
  controllers: [UserController, UserAvatarController, UserAdminController],
  providers: [UserService, UserAdminService, UserAvatarService, AuthService],
})
export class UserModule {}
