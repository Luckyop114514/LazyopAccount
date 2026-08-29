import { NestFactory } from '@nestjs/core';
import {
  BadRequestException,
  Logger,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { v4 } from 'uuid';
import { AppModule } from './app.module';
import config from './services/config';
import { GlobalHeaders } from './middlewares/protocol';
import { GlobalExceptionFilter } from './interceptors/http-exception.filter';
import session from 'express-session';
import MySQLSessionStore from 'express-mysql-session';
import { getLoggerService } from './utils/logger';
import { GlobalResponseInterceptor } from './interceptors/response';
import { GLOBAL_PREFIX } from './types/const';

async function bootstrap() {
  console.log(`

███╗   ██╗██╗   ██╗ █████╗ ███╗   ██╗ ██████╗██╗   ██╗
████╗  ██║╚██╗ ██╔╝██╔══██╗████╗  ██║██╔════╝╚██╗ ██╔╝
██╔██╗ ██║ ╚████╔╝ ███████║██╔██╗ ██║██║      ╚████╔╝ 
██║╚██╗██║  ╚██╔╝  ██╔══██║██║╚██╗██║██║       ╚██╔╝  
██║ ╚████║   ██║   ██║  ██║██║ ╚████║╚██████╗   ██║   
╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝   ╚═╝   
  
  + Copyright (C) ${new Date().getFullYear()} Lazyop All right reserved
  `);
  const app = await NestFactory.create(AppModule, {
    logger: getLoggerService(),
  });

  const MySQLStore = MySQLSessionStore(session as never);
  const sessionStore = new MySQLStore({
    host: config.database.host,
    port: config.database.port || 3306,
    user: config.database.user,
    password: config.database.password,
    database: config.database.database,
    createDatabaseTable: true,
    clearExpired: true,
    checkExpirationInterval: 15 * 60 * 1000,
    expiration: 60 * 1000 * 60 * 240,
  });

  app.use(
    session({
      secret: config.sessionSecret || v4(),
      resave: false,
      store: sessionStore,
      cookie: {
        maxAge: 60 * 1000 * 60 * 240,
        // maxAge: 10,
        httpOnly: true,
        sameSite: 'lax',
      },
      saveUninitialized: false,
    }),
  );
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.use(GlobalHeaders);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 自动剔除 DTO 中未定义的字段，如 "test"
      forbidNonWhitelisted: false, // 如果有未定义的字段，抛出错误
      transform: true,
      exceptionFactory: (errors: ValidationError[]) => {
        // 提取最后一个错误消息
        const firstError = Object.values(errors[0].constraints).reverse()[0];
        return new BadRequestException(firstError);
      },
    }),
  );
  app.useGlobalInterceptors(new GlobalResponseInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.setGlobalPrefix(GLOBAL_PREFIX);

  await app.listen(config.httpPort);
  Logger.log(`服务已启动：${await app.getUrl()}`);
}
bootstrap();
