-- 为 OIDC 支持新增的字段。老库执行一次即可，新装直接用 nya_normal.sql 无需运行。
-- 注意：不要带 CHARACTER SET / COLLATE，宝塔自带的 mysql 5.7 客户端不认 utf8mb4_0900_ai_ci

-- 应用使用的协议：oauth2（只发 access_token）或 oidc（额外签发 id_token）
ALTER TABLE `oauth_clients`
  ADD COLUMN `protocol` varchar(10) NOT NULL DEFAULT 'oauth2' AFTER `redirect`;

-- OIDC 的 nonce 与 PKCE 的 code_challenge，授权阶段暂存在授权码上
ALTER TABLE `oauth_auth_codes`
  ADD COLUMN `nonce` varchar(255) DEFAULT NULL AFTER `scopes`,
  ADD COLUMN `codeChallenge` varchar(255) DEFAULT NULL AFTER `nonce`,
  ADD COLUMN `codeChallengeMethod` varchar(10) DEFAULT NULL AFTER `codeChallenge`;