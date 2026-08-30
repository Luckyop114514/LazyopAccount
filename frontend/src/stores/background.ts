import { computed, ref } from 'vue'
import { createGlobalState } from '@vueuse/core'
import { backgroundImageUrl, getBackgroundApi } from '@/apis/site'
import type { CSSProperties } from 'vue'

// 全站背景图。放在独立的 store 里，避免 stores/index 与 utils/request 形成循环依赖
export const backgroundStore = createGlobalState(() => {
  const url = ref('')
  const enabled = ref(false)
  const opacity = ref(25)
  const blur = ref(0)

  // 开关打开且确实有图才渲染
  const active = computed(() => enabled.value && url.value.length > 0)

  const style = computed<CSSProperties>(() => ({
    backgroundImage: `url("${url.value}")`,
    opacity: opacity.value / 100,
    // 模糊会让边缘透出底色，稍微放大一点盖住
    filter: blur.value > 0 ? `blur(${blur.value}px)` : undefined,
    transform: blur.value > 0 ? `scale(${1 + blur.value / 50})` : undefined
  }))

  // 每次调用都会从后端重新随机一张
  const load = async () => {
    try {
      const { data } = await getBackgroundApi()
      enabled.value = data.enabled
      opacity.value = data.opacity
      blur.value = data.blur
      url.value = data.image ? backgroundImageUrl(data.image) : ''
    } catch (err: any) {
      console.error(err)
    }
  }

  return {
    url,
    enabled,
    opacity,
    blur,
    active,
    style,
    load
  }
})