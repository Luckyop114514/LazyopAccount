/**
 * plugins/index.ts
 *
 * Automatically included in `./src/main.ts`
 */

// Plugins
import vuetify from './vuetify'
import router from '../router'
import { createPinia } from 'pinia'

// Types
import type { App } from 'vue'

// Stores
import { userStore } from '@/stores/user'
import { backgroundStore } from '@/stores/background'

export async function registerPlugins(app: App) {
  app.use(vuetify).use(createPinia())
  const { getUserInfo } = userStore()
  const { load: loadBackground } = backgroundStore()
  // 背景图和用户信息一起取，挂载前拿到就不会闪一下
  await Promise.all([getUserInfo(), loadBackground()])
  app.use(router)
}