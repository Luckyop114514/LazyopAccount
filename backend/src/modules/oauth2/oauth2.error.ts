import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * OAuth 2.0 / OIDC 规定 token、userinfo 这些机器对机器的端点出错时，
 * 必须返回 { error, error_description } 这种扁平结构，而不是本站的统一响应体。
 * GlobalExceptionFilter 会认出这个类型并原样输出。
 */
export class OauthError extends HttpException {
  constructor(
    readonly error: string,
    readonly description?: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ error, error_description: description }, status);
  }
}