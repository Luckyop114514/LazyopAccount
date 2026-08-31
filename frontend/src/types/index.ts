import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/types'

export interface LoginForm {
  username: string
  password: string
}

export interface RegForm extends LoginForm {
  code: string
  email: string
}

export interface EmailLoginForm {
  email: string
  code: string
}

export interface NyaResponse {
  code: number
  msg: string
  time: string
  data: any
}

export enum UserStatus {
  BANNED = -1,
  NORMAL
}

export interface UserInfo {
  id: number
  username: string
  password?: string
  status: UserStatus
  role: string
  email: string
  regTime: string
  apikey: string
  verifyToken?: string
  // 自定义头像的文件名，为空表示用默认头像
  avatar?: string | null

  // 管理员获取到的是 string
  authDevice?: {
    credentialID: string
  }[]
}

export interface UserInfoRes extends NyaResponse {
  data: UserInfo
}

export interface UserListRes extends NyaResponse {
  data: {
    totalCount: number
    totalPages: number
    users: UserInfo[]
  }
}

export interface PublicKeyORes extends NyaResponse {
  data: PublicKeyCredentialCreationOptionsJSON
}

// 应用使用的协议：oauth2 只发 access_token，oidc 会额外签发 id_token
export type OauthProtocol = 'oauth2' | 'oidc'

export interface NewOauthClient {
  name: string
  redirect: string
  protocol: OauthProtocol
}

export interface EditOauthClient extends NewOauthClient {
  id: number
}

export interface AdminEditOauthClient extends EditOauthClient {
  secret: string
}

export interface OAuth2ClientInfo extends NewOauthClient {
  id: number
  userId: number
  secret: string
  createdAt: Date
  updatedAt: Date
}

export interface OAuth2ClientInfoRes extends NyaResponse {
  data: OAuth2ClientInfo[]
}

export interface OAuth2ClientLowInfoRes extends NyaResponse {
  data: {
    id: number
    createdAt: string
    name: string
    protocol: OauthProtocol
  }
}

export interface OAuth2StateRes extends NyaResponse {
  data: {
    state: string
    code: string
  }
}

export interface OAuth2AppsRes extends NyaResponse {
  data: {
    totalCount: number
    totalPages: number
    clients: OAuth2ClientInfo[]
  }
}

export interface StatisticRes extends NyaResponse {
  data: {
    oauth_clients: string
    user: string
    dailyRegStatistics: {
      date: string[]
      count: number[]
    }
  }
}

export interface SiteOptions {
  id: number
  note: string
  optionName: string
  value: string
  updatedAt: Date
}

export interface SiteOptionsRes extends NyaResponse {
  data: SiteOptions[]
}

export interface SiteBackgroundImage {
  id: number
  type: 'url' | 'file'
  // type 为 file 时后端返回 null，前端用 backgroundImageUrl 拼接
  url: string | null
  enabled: boolean
  mime?: string
  size?: number
  uploader?: number
  createdAt?: string
}

export interface SiteBackgroundSettings {
  // 是否可见
  enabled: boolean
  // 不透明度，0-100
  opacity: number
  // 模糊半径，0-30 px
  blur: number
}

export interface SiteBackgroundRes extends NyaResponse {
  data: SiteBackgroundSettings & {
    count: number
    image: SiteBackgroundImage | null
  }
}

export interface SiteBackgroundListRes extends NyaResponse {
  data: SiteBackgroundSettings & {
    images: SiteBackgroundImage[]
  }
}
export interface LoginIP {
  id: number
  uid: number
  ip: string
  location: string
  device: string
  time: Date
}

export interface LoginIPRes extends NyaResponse {
  data: {
    totalCount: number
    totalPages: number
    records: LoginIP[]
  }
}

export type SortItem = {
  key: string
  order?: boolean | 'asc' | 'desc'
}
