<p align="center">
  <img src="./frontend/public/img/nya/023.png" width="200" alt="Logo" />
</p>

<h1 align="center">Lazyop Account</h1>

<p align="center">
  <a href="https://github.com/Luckyop114514/LazyopAccount/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square" /></a>
  <img alt="Node" src="https://img.shields.io/badge/node-%E2%89%A518-blue?style=flat-square" />
  <img alt="NestJS" src="https://img.shields.io/badge/backend-NestJS-e0234e?style=flat-square" />
  <img alt="Vue" src="https://img.shields.io/badge/frontend-Vue3%20%2B%20Vuetify-42b883?style=flat-square" />
</p>

## 项目介绍

基于 OAuth 2.0 标准协议的统一账号登录服务，可让第三方应用快速接入"用本站账号登录"。

本仓库是 [Nyancy-Org/NyancyAccount](https://github.com/Nyancy-Org/NyancyAccount) 的二次开发版本，在原项目基础上完成了品牌替换、生产部署适配、**邮箱验证码登录**以及前端静态资源本地化。

- 图标及形象来自画师 [甘城なつき](https://www.pixiv.net/users/3036679) 笔下的猫羽雫

### 原项目

https://github.com/Nyancy-Org/NyancyAccount

### 官方网站

https://account.lazyop.top

## 功能

- 用户注册、登录、找回密码
- **三种登录方式**：密码 / 邮箱验证码 / PassKey（WebAuthn）
- OAuth 2.0 授权码模式，供第三方应用接入
- 个人中心：改名、换邮箱、改密码、API Key、PassKey 设备管理
- 登录日志：记录 IP、IP 归属地、设备信息
- 管理后台：用户管理、站点开关、站点统计、OAuth 应用审核
- **全站背景图**：后台上传或填外链，多张随机展示，可调可见度、不透明度与模糊

## 技术栈

| 层 | 技术 |
| --- | --- |
| 后端 | NestJS + Express + MySQL，会话存 MySQL（`express-mysql-session`） |
| 前端 | Vue 3 + Vuetify 3 + Vite |
| 邮件 | Nodemailer + MJML 模板 |
| 包管理 | pnpm |

## 目录结构

```
backend/                 NestJS 后端
  src/                   业务代码（modules / services / entities / guards / utils）
  template/email/        MJML 邮件模板
  sql/nya_normal.sql     数据库结构
  config.example.json    配置模板，复制为 config.json 后填写
frontend/                Vue 3 前端
  src/                   页面、路由、API 封装
  public/fonts/          自托管 MiSans 与 MDI 图标字体
  public/img/nya/        自托管插画
deploy/                  nginx 与 systemd 参考配置（含占位路径，需按实际修改）
wiki.md                  使用文档（用户 / 开发者 / 管理员 / 自建部署）
```

## 快速开始

### 环境要求

- Node.js ≥ 18
- pnpm
- MySQL 5.7+ / 8.0

### 1. 初始化数据库

```bash
mysql -u root -p -e "CREATE DATABASE nya DEFAULT CHARSET utf8mb4;"
mysql -u root -p nya < backend/sql/nya_normal.sql
```

> `sessions` 表由 `express-mysql-session` 首次启动时自动创建。

### 2. 后端

```bash
cd backend
pnpm install
cp config.example.json config.json   # 然后按实际情况填写
pnpm build                            # 产出 dist/
pnpm start:prod                       # 或 pnpm dev 本地开发
```

`config.json` 关键字段：

| 字段 | 说明 |
| --- | --- |
| `httpPort` | 后端监听端口，默认 1239 |
| `siteUrl` | 站点对外访问地址，用于生成邮件中的验证/重置链接，末尾不带斜杠 |
| `sessionSecret` | 会话签名密钥，用 `openssl rand -hex 32` 生成后**固定不变**，修改会导致所有用户掉登录 |
| `database` | MySQL 连接信息 |
| `isReverseProxy` | 部署在反向代理之后时设为 `true`，否则登录日志会全部记成 127.0.0.1 |
| `smtpConfig` | 发信 SMTP，QQ 邮箱需用授权码 |
| `webAuthn` | PassKey 配置，`rpID` 填域名、`expectedOrigin` 填带协议的完整来源 |

### 3. 前端

```bash
cd frontend
pnpm install
pnpm dev            # 开发服务器
pnpm build-only     # 生产构建，产出 dist/
```

> ⚠️ 请使用 `pnpm build-only` 而不是 `pnpm build`。后者会先跑 `vue-tsc` 类型检查，而源码中存在若干 `$route` / `$router` 的历史类型错误会导致构建失败。

### 4. 部署

参考 `deploy/` 下的示例：

- `deploy/nginx.conf.example` —— 静态站点 + `/v1/` 反代到后端 + 头像/随机图反代缓存
- `deploy/lazyop-account.service` —— systemd 服务单元

前端请求路径为 `/v1/xxx`，由 nginx 转发到后端 `/api/xxx`，这一映射不要改动。

## 使用文档

完整文档见 [wiki.md](./wiki.md)，包含：

- 普通用户：注册、三种登录方式、找回密码、个人中心
- 第三方开发者：OAuth 2.0 完整接入流程、接口示例、常见错误
- 管理员：用户管理、站点设置、应用审核
- 自建部署：环境要求、配置说明、反向代理、升级备份、故障排查

## 问题反馈

有 Bug 或功能建议请提交 [Issue](https://github.com/Luckyop114514/LazyopAccount/issues)。

## 与上游的差异

- 全站品牌由 `Nyancy Account` 改为 `Lazyop Account`（含邮件模板与 WebAuthn `rpName`）
- **新增邮箱验证码登录**：后端 `POST /v1/auth/emailLogin` + `emailLogin.mjml` 模板；前端新增 `/auth/emailLogin` 页面
- **新增全站背景图**：管理端「背景图」页面，支持外链与多图上传、随机展示、可见度/不透明度/模糊（表 `site_background`）
- 会话由内存改为存 MySQL，后端重启不再掉登录；`sessionSecret` 改为可配置
- 关闭限流器的 `execEvenly`，修复响应延迟逐级累积
- `backend/src/Utils` 目录改为小写 `utils`，适配大小写敏感的 Linux 文件系统
- 修正 `mjml2html` 的异步调用；Vuetify 升级至 3.5.x
- 前端外部资源本地化：插画、MiSans 字体、MDI 图标字体自托管；头像与随机图改由 nginx 反代并缓存

## 已知问题

- OAuth 2.0 的 `refresh_token` 接口目前为空实现（上游 `// TODO`），接入方请勿依赖刷新令牌
- 前端 `pnpm build` 的类型检查未修复，需用 `build-only`

## 安全提示

- `backend/config.json` 含数据库密码、SMTP 授权码与 `sessionSecret`，已在 `.gitignore` 中排除，请勿提交
- 生产环境不要把 MySQL 端口暴露到公网
- 定期轮换 SMTP 授权码与数据库密码

## 许可证

沿用上游协议，基于 [Apache License 2.0](./LICENSE) 开源。
