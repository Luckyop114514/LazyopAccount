> 本文档由 AI 生成整理，请注意辨别；如发现错误欢迎提 Issue 指正。

# Lazyop Account 使用文档

一个统一账号登录服务，同时支持 **OAuth 2.0** 与 **OpenID Connect**。本文分四部分：普通用户、第三方开发者、管理员、自建部署。

- 仓库：https://github.com/Luckyop114514/LazyopAccount
- 问题反馈：https://github.com/Luckyop114514/LazyopAccount/issues

---

## 目录

1. [普通用户](#一普通用户)
2. [第三方开发者（OAuth 2.0 / OIDC 接入）](#二第三方开发者oauth-20--oidc-接入)
3. [管理员](#三管理员)
4. [自建部署](#四自建部署)
5. [附录：接口总表与约定](#五附录)

---

## 一、普通用户

### 1.1 注册账号

打开站点首页，点击「注册」，分三步填写：

| 步骤 | 要求 |
| --- | --- |
| 用户名 | 3–20 位，仅字母、数字、下划线，实时校验是否被占用 |
| 邮箱 | 填写后点击「发送验证码」，邮箱会收到 6 位数字验证码（注意查收垃圾箱） |
| 密码 | 8–32 位，需二次确认 |

提交成功后自动登录。

> 验证码每 60 秒只能请求一次，且为一次性，使用后立即失效。

### 1.2 三种登录方式

| 方式 | 路径 | 说明 |
| --- | --- | --- |
| 密码登录 | `/auth/login` | 账号栏可填**用户名或邮箱**，第二步输入密码 |
| 邮箱验证码登录 | `/auth/emailLogin` | 输入已注册邮箱 → 收验证码 → 输入 6 位码登录，无需密码 |
| PassKey（通行密钥） | 登录页「PassKey 登录」 | 需先在「安全设置」绑定设备（指纹 / Windows Hello / 手机） |

登录页第一步可在按钮区切换这三种方式。

**邮箱验证码登录的限制**

- 邮箱必须是**已注册**的，未注册会直接报错，不会自动建号
- 验证码请求：60 秒最多 1 次
- 登录尝试：60 秒最多 5 次
- 验证码用过即废

### 1.3 忘记密码

1. 登录页点击「忘记密码」，输入注册邮箱
2. 收到一封含**重置链接**的邮件，点击打开
3. 设置新密码

重置链接为一次性，失效后需重新申请。

### 1.4 个人中心

登录后左侧导航：

- **仪表板**：账号概览与最近登录记录
- **个人资料**：修改用户名、修改邮箱（需新邮箱验证码）、修改密码
- **安全设置**：绑定 / 删除 PassKey 设备；查看与重置 **API Key**（重置后旧 Key 立即失效）
- **我的应用**：创建和管理自己的 OAuth 应用
- **登录日志**：登录时间、IP、IP 归属地、设备信息，支持搜索与排序

**换头像**：在个人中心左边点自己的头像就能换，支持 jpg / png / webp / gif / avif，单张不超过 2 MB，一个账号只保留最新的一张。没设置过自定义头像时，会按邮箱自动生成一个默认头像（Gravatar 镜像），弹窗里的「恢复默认」可以随时删掉自定义头像。

> 发现陌生登录记录时，请立即修改密码并重置 API Key。

---

## 二、第三方开发者（OAuth 2.0 / OIDC 接入）

本服务提供标准 **Authorization Code**（授权码）模式，支持 PKCE。下文以 `https://account.example.com` 代表你接入的站点地址。

### 2.1 创建应用

1. 登录后进入「我的应用」，新建应用
2. 填写应用名称与回调地址 `redirect_uri`（后续请求必须与此完全一致）
3. 选择**协议**：
   - **OAuth 2.0**：只签发 `access_token`，你自己调 `/v1/oauth2/user` 拿用户信息
   - **OpenID Connect**：额外签发 RS256 签名的 `id_token`，可被支持自动发现的客户端（Grafana、Gitea、Outline、Keycloak 等）直接接入，详见 2.6
4. 获得 `client_id`（数字）与 `client_secret`（40 位字符串）

协议随时可以在应用详情里改，不影响 `client_id` / `client_secret`。历史应用默认都是 OAuth 2.0。

> `client_secret` 仅在创建或重置时可见，请自行妥善保存；忘记时可在应用详情「重置密钥」，旧密钥立即失效。

### 2.2 授权流程

```
用户浏览器                你的服务                Lazyop Account
    │                        │                        │
    │ 1. 点击"用 Lazyop 登录" │                        │
    │───────────────────────>│                        │
    │ 2. 跳转到授权页          │                        │
    │<───────────────────────│                        │
    │ 3. 用户确认授权（需已登录）                        │
    │──────────────────────────────────────────────────>│
    │ 4. 带 code 回调到 redirect_uri                     │
    │<──────────────────────────────────────────────────│
    │ 5. code 交给你的后端     │                        │
    │───────────────────────>│ 6. code + secret 换 token│
    │                        │───────────────────────>│
    │                        │ 7. access_token         │
    │                        │<───────────────────────│
    │                        │ 8. Bearer 拉取用户信息   │
    │                        │───────────────────────>│
```

### 2.3 接口细节

#### （1）查询应用公开信息

```http
GET /v1/oauth2/client/{client_id}
```

返回应用的 `id` / `name` / `createdAt`，用于在授权页展示"某某应用请求访问你的账号"。

#### （2）请求授权码

```http
POST /v1/oauth2/authorize?client_id=1&redirect_uri=https://your.app/callback&response_type=code&scope=user&state=RANDOM_STRING
Cookie: connect.sid=...        # 必须是已登录的会话
```

可选参数：`nonce`（OIDC，会原样写进 `id_token`）、`code_challenge` 与 `code_challenge_method`（PKCE，支持 `S256` / `plain`）。

> 实际接入时你不需要自己调这个接口，把用户浏览器重定向到授权页 `https://account.example.com/oauth2/authorize?...` 即可，页面会在用户点「授权」后代为调用它并带 `code` 跳回你的 `redirect_uri`。

响应：

```json
{
  "code": 200,
  "msg": "ok",
  "data": { "state": "RANDOM_STRING", "code": "0xxxxxxxxxxx...1700000000000" },
  "time": 1700000000000
}
```

- 授权码长度 80（结构为 `'0'` + 66 位随机串 + 13 位时间戳）
- **有效期 3 分钟**
- 同一用户对同一应用重复请求时，旧授权码会被作废
- `state` 原样回传，请在你的服务端校验以防 CSRF

#### （3）用授权码换令牌

```http
POST /v1/oauth2/token
Content-Type: application/json

{
  "grant_type": "authorization_code",
  "client_id": 1,
  "client_secret": "YOUR_CLIENT_SECRET",
  "redirect_uri": "https://your.app/callback",
  "code": "0xxxxxxxxxxx...1700000000000"
}
```

响应（**此接口不带 `code`/`msg` 包装，直接返回裸对象**）：

```json
{
  "access_token": "NYANCY_xxxxxxxx_ACCESS_TOKEN",
  "token_type": "Bearer",
  "refresh_token": "NYANCY_xxxxxxxx_REFRESH_TOKEN",
  "expires_in": 604800,
  "scope": "openid profile email",
  "id_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ii4uLiJ9...."
}
```

- 同时支持 `Content-Type: application/json` 与 `application/x-www-form-urlencoded`
- 客户端凭据可以放在请求体（`client_secret_post`），也可以走 `Authorization: Basic base64(client_id:client_secret)`（`client_secret_basic`）
- `access_token` 有效期 7 天；`refresh_token` 30 天
- `id_token` **只对协议选了 OIDC 的应用签发**，且 `scope` 必须包含 `openid`
- 授权阶段带了 `code_challenge` 的话，这里必须一并给出 `code_verifier`
- 出错时返回规范定义的 `{"error": "...", "error_description": "..."}`，常见值：`invalid_client`、`invalid_grant`、`invalid_request`、`unsupported_grant_type`

#### （3.1）刷新令牌

```http
POST /v1/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&refresh_token=NYANCY_..._REFRESH_TOKEN&client_id=1&client_secret=YOUR_CLIENT_SECRET
```

响应结构与授权码换令牌一致。刷新采用**轮换**策略：旧的 `access_token` 与 `refresh_token` 会立即作废，请保存新返回的这一对。

#### （4）获取用户信息

```http
GET /v1/oauth2/user
Authorization: Bearer NYANCY_xxxxxxxx_ACCESS_TOKEN
```

返回用户信息，已剔除密码、校验令牌、API Key、PassKey 设备等敏感字段。

### 2.4 接入示例（Node.js）

```js
const ACCOUNT = 'https://account.example.com'

// 第一步：把用户送去授权
app.get('/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex')
  req.session.oauthState = state
  const q = new URLSearchParams({
    client_id: '1',
    redirect_uri: 'https://your.app/callback',
    response_type: 'code',
    scope: 'user',
    state,
  })
  res.redirect(\`\${ACCOUNT}/oauth2/authorize?\${q}\`)
})

// 第二步：回调里换 token 并拉用户
app.get('/callback', async (req, res) => {
  const { code, state } = req.query
  if (!state || state !== req.session.oauthState) {
    return res.status(400).send('state 校验失败')
  }
  delete req.session.oauthState

  const tokenRes = await fetch(\`\${ACCOUNT}/v1/oauth2/token\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: 1,
      client_secret: process.env.OAUTH_CLIENT_SECRET,
      redirect_uri: 'https://your.app/callback',
      code,
    }),
  })
  const { access_token } = await tokenRes.json()

  const userRes = await fetch(\`\${ACCOUNT}/v1/oauth2/user\`, {
    headers: { Authorization: \`Bearer \${access_token}\` },
  })
  const { data: user } = await userRes.json()

  req.session.user = user
  res.redirect('/')
})
```

> `client_secret` 请放在环境变量或密钥管理服务中，绝不要写进前端代码或提交到仓库。

### 2.5 常见错误

| 现象 | 原因 |
| --- | --- |
| 授权接口返回 401 | 当前浏览器没有登录本站的有效会话 |
| token 接口报参数错误 | `client_id` 传成了字符串，或 `redirect_uri` 与注册值不一致 |
| 授权码无效 | 超过 3 分钟、已被使用过，或同一用户又发起了新的授权 |
| 429 Too Many Requests | 触发限流，读 `retry-after` 响应头等待后重试 |
| 用户信息接口 401 | `access_token` 过期（7 天）或 `Authorization` 头格式不对 |
| token 接口返回 `invalid_client` | `client_id` / `client_secret` 不对，或凭据既没放请求体也没放 Basic 头 |
| 换不到 `id_token` | 应用协议不是 OIDC，或授权请求的 `scope` 里没有 `openid` |

### 2.6 OpenID Connect 接入

应用协议选 **OpenID Connect** 后，本站就是一个标准的 OIDC Provider，支持自动发现。

**发现地址**（多数客户端只需要填这一个 URL）：

```
https://account.example.com/.well-known/openid-configuration
```

它会返回各端点的绝对地址，其中：

| 名称 | 地址 |
| --- | --- |
| `issuer` | `https://account.example.com` |
| `authorization_endpoint` | `https://account.example.com/oauth2/authorize` |
| `token_endpoint` | `https://account.example.com/v1/oauth2/token` |
| `userinfo_endpoint` | `https://account.example.com/v1/oauth2/userinfo` |
| `jwks_uri` | `https://account.example.com/.well-known/jwks.json` |

**支持的能力**

- `response_types_supported`：`code`（仅授权码模式，不支持 implicit / hybrid）
- `grant_types_supported`：`authorization_code`、`refresh_token`
- `scopes_supported`：`openid`、`profile`、`email`
- `id_token_signing_alg_values_supported`：`RS256`
- `token_endpoint_auth_methods_supported`：`client_secret_post`、`client_secret_basic`
- `code_challenge_methods_supported`：`S256`、`plain`

**id_token 的 claims**

```json
{
  "iss": "https://account.example.com",
  "sub": "31",
  "aud": "1",
  "iat": 1700000000,
  "exp": 1700000600,
  "auth_time": 1700000000,
  "nonce": "客户端传来的 nonce",
  "at_hash": "...",
  "name": "Lazyop_",
  "preferred_username": "Lazyop_",
  "nickname": "Lazyop_",
  "picture": "https://account.example.com/avatar/....",
  "email": "hi@example.com",
  "email_verified": true,
  "updated_at": 1700000000
}
```

- `sub` 是本站用户 ID 的字符串形式，**永不变更**，请用它作为用户唯一标识，不要用用户名或邮箱
- `id_token` 有效期 10 分钟，只用于确认身份；后续请求用 `access_token`
- `email_verified` 恒为 `true`：本站注册与改邮箱都必须过邮件验证码
- 只申请了 `openid` 时也会返回全部 claims；申请了 `profile` 或 `email` 则按 scope 过滤

**userinfo 端点**

```http
GET /v1/oauth2/userinfo
Authorization: Bearer NYANCY_xxxxxxxx_ACCESS_TOKEN
```

返回上表中除 `iss` / `aud` / `exp` / `iat` / `nonce` / `at_hash` 之外的那些 claims，**不套本站统一响应体**。同时支持 `POST`。

> 老的 `GET /v1/oauth2/user` 接口保持原样不变，返回的是本站自有字段（`id` / `username` / `email` / `avatar` ...），已接入的应用不受影响。

**签名密钥**

私钥在后端首次启动时自动生成，存放在后端工作目录的 `keys/oidc-rsa.pem`。**不要删除或替换它**，否则所有已签发的 `id_token` 会验签失败。备份站点时记得把它一起备份。

---

## 三、管理员

管理入口位于登录后的「管理」导航，仅对管理员角色可见。

### 3.1 用户管理

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/v1/user/list` | 用户列表（分页、搜索） |
| GET | `/v1/user/info/:uid` | 查看指定用户详情 |
| PUT | `/v1/user/` | 修改用户资料与权限 |
| DELETE | `/v1/user/` | 删除用户 |
| GET | `/v1/user/admin/loginLogs` | 全站登录日志 |

### 3.2 站点设置

- `GET /v1/site/options` / `PUT /v1/site/options`：站点配置。目前提供 `allowReg`（是否开放注册，关闭后前端注册入口会被拦截）以及背景图的 `bgEnabled` / `bgOpacity` / `bgBlur`（建议直接在「背景图」页面里改）
- `GET /v1/site/statistic`：站点统计（用户数、日活等）

### 3.3 背景图

管理端「背景图」页面可以给全站加一张（或多张）背景图，登录页、用户中心、管理后台都会生效，未登录的访客同样可见。

- **添加方式**：外链地址（一行一个，支持 `http(s)://` 或站内绝对路径）、本地上传（jpg / png / webp / gif / avif，单张 ≤ 10 MB，一次 ≤ 5 张）
- **多张随机**：启用状态的图片有多张时，访客每次打开页面会随机拿到其中一张
- **可见度**：总开关，关掉后立即恢复纯色背景，图片不会被删除
- **不透明度**：0-100，数值越低背景越淡、正文越清楚，默认 25
- **模糊**：0-30 px，给背景加高斯模糊，进一步提高文字可读性
- 铺了背景图之后卡片会自动变成半透明磨砂底，避免文字看不清

上传的文件放在后端工作目录的 `uploads/background/`，文件名由服务端重新生成（uuid），删除图片时会一起清理。出于安全考虑不接受 svg（可携带脚本）。

如果要上传较大的图片，注意反向代理的 `client_max_body_size` 要大于单张上限。

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/v1/site/background` | 公开 | 显示设置 + 随机一张已启用的图 |
| GET | `/v1/site/background/file/:id` | 公开 | 读取本地上传的图片文件 |
| GET | `/v1/site/background/list` | 管理员 | 显示设置 + 全部图片 |
| PUT | `/v1/site/background/settings` | 管理员 | `{enabled, opacity, blur}` |
| POST | `/v1/site/background/url` | 管理员 | `{urls: string[]}` |
| POST | `/v1/site/background/upload` | 管理员 | multipart，字段名 `files` |
| PATCH | `/v1/site/background/:id` | 管理员 | `{enabled}` 启用/停用单张 |
| DELETE | `/v1/site/background/:id` | 管理员 | 删除单张 |

### 3.4 OAuth 应用审核

- `GET /v1/oauth2/admin/clients`：全站应用列表
- `PUT /v1/oauth2/admin/client` / `DELETE /v1/oauth2/admin/client`：修改或下架任意应用

---

## 四、自建部署

### 4.1 环境要求

- Node.js ≥ 18
- pnpm
- MySQL 5.7+ / 8.0
- 一个反向代理（nginx 等）用于统一入口与 TLS

### 4.2 初始化数据库

```bash
mysql -u root -p -e "CREATE DATABASE nya DEFAULT CHARSET utf8mb4;"
mysql -u root -p nya < backend/sql/nya_normal.sql
```

建议为应用单独建一个只对 `nya` 库有权限的账号，不要直接用 root。`sessions` 表会在后端首次启动时自动创建。

### 4.3 后端

```bash
cd backend
pnpm install
cp config.example.json config.json     # 按实际情况填写
pnpm build
pnpm start:prod
```

`config.json` 字段说明：

| 字段 | 说明 |
| --- | --- |
| `httpPort` | 后端监听端口，默认 1239 |
| `siteUrl` | 站点对外访问地址（如 `https://account.example.com`），用于生成邮件链接，同时作为 OIDC 的 `issuer` 与发现文档里所有端点的前缀，**必须和用户实际访问的域名完全一致**，末尾不要带斜杠 |
| `sessionSecret` | 会话签名密钥，用 `openssl rand -hex 32` 生成后**固定不变**；改动会导致所有用户掉登录 |
| `database` | MySQL 连接信息（host / port / user / password / database） |
| `isReverseProxy` | 部署在反向代理之后时设为 `true`，否则登录日志会全部记成 `127.0.0.1` |
| `isCdn` | 前置了 CDN 时设为 `true` |
| `smtpConfig` | 发信 SMTP；多数邮箱服务商需要使用"授权码"而非登录密码 |
| `webAuthn` | PassKey 配置：`rpID` 填域名（不带协议），`expectedOrigin` 填带协议的完整来源 |

> `config.json` 含数据库密码、SMTP 授权码与会话密钥，已在 `.gitignore` 中排除，**不要提交到仓库**。

### 4.4 前端

```bash
cd frontend
pnpm install
pnpm dev            # 本地开发
pnpm build-only     # 生产构建，产出 dist/
```

> ⚠️ 生产构建请用 `pnpm build-only`。`pnpm build` 会先执行 `vue-tsc` 类型检查，而源码中存在若干 `$route` / `$router` 的历史类型错误会导致构建中断。

把 `frontend/dist` 作为静态站点根目录交给 nginx 即可。

### 4.5 反向代理

参考 `deploy/nginx.conf.example`，核心只有三条：

1. 静态资源指向 `frontend/dist`，并配置 SPA 回退 `try_files $uri $uri/ /index.html`
2. 前端请求路径 `/v1/xxx` 转发到后端 `/api/xxx`，**这个映射不要改动**
3. OIDC 的两个发现地址要挂在域名根下，否则第三方客户端找不到：
   - `/.well-known/openid-configuration` → `/api/oauth2/.well-known/openid-configuration`
   - `/.well-known/jwks.json` → `/api/oauth2/jwks.json`

```nginx
location /v1/ {
    proxy_pass http://127.0.0.1:1239/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
}
```

若要让登录日志记录真实访客 IP，需在代理层透传 `X-Forwarded-For`，并在 nginx 用 `set_real_ip_from` + `real_ip_header` 还原，同时把后端 `isReverseProxy` 置为 `true`。

### 4.6 进程守护

参考 `deploy/lazyop-account.service`（systemd 单元），要点：

- 用非 root 的专用系统账号运行
- `WorkingDirectory` 指向后端目录，`ExecStart` 执行 `node dist/main.js`
- `Restart=always` 保证异常退出后自动拉起

### 4.7 升级与备份

```bash
# 拉取新代码后
cd backend  && pnpm install && pnpm build && sudo systemctl restart <服务名>
cd frontend && pnpm install && pnpm build-only

# 备份：数据库 + 配置文件
mysqldump -u <用户> -p <库名> > backup-$(date +%F).sql
```

配置文件 `backend/config.json` 请与数据库一起备份——其中的 `sessionSecret` 丢失会导致全站掉登录。上传的背景图与头像在 `backend/uploads/`，OIDC 签名私钥在 `backend/keys/oidc-rsa.pem`（丢了会让所有已签发的 `id_token` 验签失败），备份时别漏掉。

从旧版本升级时，数据库要补上后来新增的字段和表（已经有了会报重复，忽略即可）：

```sql
alter table `user` add column `avatar` varchar(255) default null;
```

```bash
# OIDC 相关字段
mysql -u <用户> -p <库名> < backend/sql/migrations/2026-08-31-oidc.sql
```

### 4.8 故障排查

| 现象 | 排查方向 |
| --- | --- |
| 502 Bad Gateway | 后端进程未运行或端口不匹配，查看服务状态与后端日志 |
| 页面能开但接口全 404 | `/v1/` → `/api/` 的转发规则被改坏 |
| 刷新后掉登录 | `sessionSecret` 被改动，或 `sessions` 表被清空 |
| 登录后一进某个页面就变成未登录 / 403 | 该页面加载的反代资源（头像、随机图等）上游返回了同名 Cookie，覆盖了本站会话。给这些 `location` 加 `proxy_hide_header Set-Cookie` |
| 登录日志 IP 全是 127.0.0.1 | 未透传 `X-Forwarded-For`，或 `isReverseProxy` 没设为 `true` |
| 收不到验证码邮件 | SMTP 授权码失效或被服务商风控，查后端日志中的 SMTP 报错 |
| 大量 429 | 全局限流为 25 req/s，确认是否被刷；必要时调整 `app.module.ts` 中的 ThrottlerModule |
| PassKey 无法绑定 | `rpID` / `expectedOrigin` 与实际访问域名不一致，或站点未走 HTTPS |
| 图标显示为方框 | 自托管的图标字体路径不对，检查 `/fonts/` 是否能正常返回 |
| 前端发版后页面空白 / 一直跳回旧页面 | 浏览器缓存了旧的 `index.html`，去请求已被删除的 chunk。给 nginx 加上 `location = /index.html { expires -1; }`，再强制刷新一次 |

### 4.9 安全建议

- 数据库只监听本机，不要把端口暴露到公网
- 用独立的低权限数据库账号，避免使用 root
- 定期轮换 SMTP 授权码与数据库密码
- 全站强制 HTTPS（PassKey/WebAuthn 也要求安全来源）
- 不要把 `config.json`、`.env`、证书私钥提交到版本库

---

## 五、附录

### 5.1 全局约定

- 前端调用 `/v1/xxx`，由反向代理转发到后端 `/api/xxx`
- 统一响应体：

  ```json
  { "code": 200, "msg": "ok", "data": {}, "time": 1700000000000 }
  ```

  出错时为 `{ "code": 400, "msg": "错误信息", "data": null, "time": ..., "path": "/api/xxx" }`
  （唯一例外是 `/v1/oauth2/token`，直接返回裸令牌对象）
- 身份凭据：浏览器会话使用 Cookie `connect.sid`（服务端存 MySQL）；第三方调用使用 `Authorization: Bearer`
- 全局限流 **25 req/s**，超限返回 429 并带 `retry-after` 响应头

### 5.2 接口总表

**认证 `/v1/auth`**

| 方法 | 路径 | 参数 | 限流 |
| --- | --- | --- | --- |
| POST | `/login` | `{username, password}`，username 可为邮箱 | 全局 |
| POST | `/emailLogin` | `{email, code}` | 60s / 5 次 |
| POST | `/register` | `{username, password, email, code}` | 全局 |
| POST | `/logout` | — | 全局 |
| POST | `/checkEmail` | `{email}` | 全局 |
| POST | `/checkUserName` | `{username}` | 全局 |
| POST | `/sendEmailCode` | `{email, type}`，type ∈ `reg` / `changeEmail` / `universal` / `emailLogin` | 60s / 1 次 |
| POST | `/sendEmailLink` | `{email, type: 'resetPwd'}` | 60s / 1 次 |
| POST | `/reset` | `{password, code}` | 全局 |
| POST | `/registrationOptions` | PassKey 登录：取挑战 | 全局 |
| POST | `/verifyRegistration` | PassKey 登录：校验 | 全局 |

**用户 `/v1/user`**

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/info` | 当前用户信息 |
| PUT | `/update/:type` | type ∈ `name` / `email` / `password` / `apikey` |
| GET | `/loginLogs` | 查询参数 `page`、`pageSize`、`sortBy`、`sortDesc`、`search` |
| GET | `/registrationOptions` | 绑定 PassKey：取挑战 |
| POST | `/verifyRegistration` | 绑定 PassKey：校验 |
| DELETE | `/deleteRegistration` | 删除 PassKey |
| GET | `/avatar/file/:uid` | **公开**，读取指定用户的自定义头像 |
| POST | `/avatar` | 上传自定义头像，multipart，字段名 `file`，≤ 2 MB |
| DELETE | `/avatar` | 删除自定义头像，恢复成按邮箱生成的默认头像 |

**站点 `/v1/site`**（需管理员）：`GET /options`、`PUT /options`、`GET /statistic`；背景图接口见 3.3，其中 `GET /background` 与 `GET /background/file/:id` 对访客公开

**OAuth 2.0 / OIDC `/v1/oauth2`**

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/client/:client_id` | 应用公开信息（`id` / `name` / `protocol` / `createdAt`） |
| POST | `/authorize` | 换授权码，需已登录会话 |
| POST | `/token` | 换令牌，支持 `authorization_code` 与 `refresh_token` |
| GET | `/user` | 本站自有格式的用户信息（老接口） |
| GET/POST | `/userinfo` | OIDC 标准 claims |
| GET | `/.well-known/openid-configuration` | 发现文档，对外经 nginx 映射到域名根下 |
| GET | `/jwks.json` | 签名公钥，对外为 `/.well-known/jwks.json` |

应用自管理为 `GET/POST/PUT/DELETE /user/clients`、`/user/client`、`POST /user/client/reset/:id`

### 5.3 数据表

`user`、`user_ip`、`site`、`site_background`、`oauth_clients`、`oauth_auth_codes`、`oauth_access_tokens`、`oauth_refresh_tokens`、`daily_statistics`、`friend_links`，以及运行时自动创建的 `sessions`。

### 5.4 与上游的差异

本项目基于 [Nyancy-Org/NyancyAccount](https://github.com/Nyancy-Org/NyancyAccount) 二次开发，主要改动：

- 全站品牌由 `Nyancy Account` 改为 `Lazyop Account`（含邮件模板与 WebAuthn `rpName`）
- **新增邮箱验证码登录**：后端 `POST /v1/auth/emailLogin` + `emailLogin.mjml` 模板，前端新增 `/auth/emailLogin` 页面并在登录页加入口
- **新增全站背景图**：管理端可上传或填外链，多张随机展示，可调可见度、不透明度与模糊（表 `site_background`）
- **新增自定义头像**：个人中心点头像即可上传，存在 `uploads/avatar/`，未设置时仍回落到 Gravatar 镜像（`user.avatar` 字段）
- **新增 OpenID Connect 支持**：建应用时可选 OAuth 2.0 或 OIDC，补齐发现文档、JWKS、RS256 `id_token`、标准 userinfo、PKCE，并实现了上游留空的 `refresh_token`
- 会话由内存改为存 MySQL（`express-mysql-session`），后端重启不再掉登录；`sessionSecret` 改为可配置
- 开启 `trust proxy`，登录日志记录真实访客 IP
- 限流器关闭 `execEvenly`，修复响应延迟逐级累积
- `backend/src/Utils` 目录改为小写 `utils`，适配大小写敏感的文件系统
- 修正 `mjml2html` 的异步调用；Vuetify 升级至 3.5.x
- 前端外部资源本地化：插画与字体自托管，头像、随机图改由 nginx 反代并缓存

### 5.5 已知问题

- 不支持 implicit / hybrid 流程，也没有 `end_session_endpoint`（单点登出）与动态客户端注册
- 每个应用只能登记一个 `redirect_uri`，且必须完全一致
- `scope` 只区分 `openid` / `profile` / `email`，没有更细的权限划分
- 前端 `pnpm build` 的类型检查未修复，生产构建需用 `build-only`

---

有问题或建议请提交 [Issue](https://github.com/Luckyop114514/LazyopAccount/issues)。
