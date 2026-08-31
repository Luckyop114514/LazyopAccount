import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  Logger,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { NyaResponse } from 'src/types';
import { OauthError } from 'src/modules/oauth2/oauth2.error';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor() {
    Logger.log('GlobalExceptionFilter 已启动');
  }

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    Logger.error(
      `[${status}] ${request.headers['x-real-ip'] || request.socket.remoteAddress} [${request.method}] ${request.url} ${status >= 500 ? '🤣👉 ' + exception.stack : ''}`,
    );

    // OAuth 2.0 / OIDC 端点必须返回规范定义的错误体，不能套统一响应体，
    // 否则第三方客户端库解析不出错误原因
    if (exception instanceof OauthError) {
      if (status === HttpStatus.UNAUTHORIZED)
        response.header(
          'WWW-Authenticate',
          `Bearer error="${exception.error}"`,
        );
      response.status(status).json(exception.getResponse());
      return;
    }

    const sendBody: NyaResponse<null> = {
      code: status,
      msg: exception.message,
      data: null,
      time: Date.now(),
      path: request.originalUrl,
    };

    response.status(status).json(sendBody);
  }
}