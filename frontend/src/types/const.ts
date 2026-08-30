import { UserStatus } from '.'
export const userStatus: Record<UserStatus, string> = {
  [UserStatus.BANNED]: '封禁',
  [UserStatus.NORMAL]: '正常'
}

// 后端只把 -1 当作封禁（见 auth.service.ts 的 loginInfo），
// 其余值（0、null、历史脏数据）都是可以正常登录的，
// 直接拿 status 去查表的话，遇到表里没有的值状态列会渲染成空白
export const isBanned = (status?: number | null) => Number(status) === UserStatus.BANNED

export const userStatusText = (status?: number | null) =>
  isBanned(status) ? userStatus[UserStatus.BANNED] : userStatus[UserStatus.NORMAL]
