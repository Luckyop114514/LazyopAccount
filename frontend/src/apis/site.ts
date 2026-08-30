import {
  NyaResponse,
  StatisticRes,
  SiteOptionsRes,
  SiteOptions,
  SiteBackgroundImage,
  SiteBackgroundListRes,
  SiteBackgroundRes,
  SiteBackgroundSettings
} from '@/types'
import { axios, baseURL as apiBaseURL } from '@/utils/request'

// 请求地址前缀
const baseURL = '/site'
const bgURL = baseURL + '/background'

// 获取站点统计数据
export const getStatisticApi = async () => {
  const { data }: { data: StatisticRes } = await axios.get(baseURL + '/statistic?t_=' + Date.now())
  return data
}

// 获取站点配置
export const getConfigApi = async () => {
  const { data }: { data: SiteOptionsRes } = await axios.get(baseURL + '/options?t_=' + Date.now())
  return data
}

// 修改站点配置
export const updateConfigApi = async (formData: SiteOptions) => {
  const { data }: { data: NyaResponse } = await axios.put(
    baseURL + '/options?t_=' + Date.now(),
    formData
  )
  return data
}

// 拼接背景图地址：外链用原地址，本地上传的走后端接口
export const backgroundImageUrl = (image: SiteBackgroundImage) =>
  image.type === 'url' ? image.url || '' : `${apiBaseURL}${bgURL}/file/${image.id}`

// 获取全站背景图，公开接口，多张时每次随机返回一张
export const getBackgroundApi = async () => {
  const { data }: { data: SiteBackgroundRes } = await axios.get(bgURL + '?t_=' + Date.now())
  return data
}

// 获取全部背景图与显示设置
export const getBackgroundListApi = async () => {
  const { data }: { data: SiteBackgroundListRes } = await axios.get(
    bgURL + '/list?t_=' + Date.now()
  )
  return data
}

// 保存背景图显示设置
export const updateBackgroundSettingsApi = async (settings: SiteBackgroundSettings) => {
  const { data }: { data: NyaResponse } = await axios.put(bgURL + '/settings', settings)
  return data
}

// 通过外链地址添加背景图，支持多个
export const addBackgroundUrlApi = async (urls: string[]) => {
  const { data }: { data: NyaResponse } = await axios.post(bgURL + '/url', { urls })
  return data
}

// 上传背景图，支持多张
export const uploadBackgroundApi = async (files: File[]) => {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))
  const { data }: { data: NyaResponse } = await axios.post(bgURL + '/upload', formData)
  return data
}

// 启用/停用单张背景图
export const toggleBackgroundApi = async (id: number, enabled: boolean) => {
  const { data }: { data: NyaResponse } = await axios.patch(`${bgURL}/${id}`, { enabled })
  return data
}

// 删除单张背景图
export const delBackgroundApi = async (id: number) => {
  const { data }: { data: NyaResponse } = await axios.delete(`${bgURL}/${id}`)
  return data
}