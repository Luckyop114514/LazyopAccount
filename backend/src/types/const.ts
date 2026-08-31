export const GLOBAL_PREFIX = 'api';
// 反向代理暴露给外部的前缀，nginx 把 /v1/xxx 转发到后端的 /api/xxx。
// 只用于拼 OIDC 发现文档里的绝对地址，改了代理规则记得同步这里
export const PUBLIC_API_PREFIX = 'v1';
export const ERR_UNSUPPORTED_DATA_TYPE = '不支持的数据类型';