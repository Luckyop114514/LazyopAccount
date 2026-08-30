<script lang="ts" setup>
import { computed, ref } from 'vue'
import _ from 'lodash'
import { indexStore } from '@/stores'
import { backgroundStore } from '@/stores/background'
import {
  addBackgroundUrlApi,
  backgroundImageUrl,
  delBackgroundApi,
  getBackgroundListApi,
  toggleBackgroundApi,
  updateBackgroundSettingsApi,
  uploadBackgroundApi
} from '@/apis/site'
import { SiteBackgroundImage, SiteBackgroundSettings } from '@/types'

// 与后端 site.background.service.ts 里的限制保持一致
const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_FILE_COUNT = 5

const { showMsg, openConfirmDialog } = indexStore()
const { load: reloadBackground } = backgroundStore()

const loading = ref(false)
const saving = ref(false)
const adding = ref(false)
const uploading = ref(false)

const settings = ref<SiteBackgroundSettings>({ enabled: false, opacity: 25, blur: 0 })
const images = ref<SiteBackgroundImage[]>([])
const urlText = ref('')
const files = ref<File[]>([])

const enabledCount = computed(() => images.value.filter((i) => i.enabled).length)

// 获取数据
const loadItems = _.throttle(async () => {
  try {
    loading.value = true
    const { data } = await getBackgroundListApi()
    settings.value = {
      enabled: data.enabled,
      opacity: data.opacity,
      blur: data.blur
    }
    images.value = data.images
  } catch (err: any) {
    console.error(err)
  } finally {
    loading.value = false
  }
}, 1000)

loadItems()

const refreshItems = async () => {
  await loadItems()
  // 让当前页面立刻用上新配置
  await reloadBackground()
}

// 保存显示设置
const saveSettings = async () => {
  try {
    saving.value = true
    const { msg } = await updateBackgroundSettingsApi(settings.value)
    showMsg(msg, 'green')
    await reloadBackground()
  } finally {
    saving.value = false
  }
}

// 通过外链地址添加，一行一个
const addUrls = async () => {
  const urls = urlText.value
    .split('\n')
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
  if (urls.length === 0) return showMsg('请先填写图片地址', 'red')

  try {
    adding.value = true
    const { msg } = await addBackgroundUrlApi(urls)
    showMsg(msg, 'green')
    urlText.value = ''
    await refreshItems()
  } finally {
    adding.value = false
  }
}

// 上传本地图片，支持多张
const uploadFiles = async () => {
  if (files.value.length === 0) return showMsg('请先选择图片', 'red')
  if (files.value.length > MAX_FILE_COUNT)
    return showMsg(`一次最多上传 ${MAX_FILE_COUNT} 张`, 'red')

  const tooBig = files.value.find((f) => f.size > MAX_FILE_SIZE)
  if (tooBig) return showMsg(`${tooBig.name} 超过了 10 MB`, 'red')

  try {
    uploading.value = true
    const { msg } = await uploadBackgroundApi(files.value)
    showMsg(msg, 'green')
    files.value = []
    await refreshItems()
  } finally {
    uploading.value = false
  }
}

// 启用/停用单张
const toggle = async (item: SiteBackgroundImage, enabled: boolean) => {
  try {
    const { msg } = await toggleBackgroundApi(item.id, enabled)
    item.enabled = enabled
    showMsg(msg, 'green')
    await reloadBackground()
  } catch (err: any) {
    await refreshItems()
  }
}

const toDelete = async (item: SiteBackgroundImage) => {
  const flag = await openConfirmDialog('警告', `你确定要删除这张背景图？此操作不可逆转！`)
  if (!flag) return
  const { msg } = await delBackgroundApi(item.id)
  showMsg(msg, 'green')
  await refreshItems()
}

const previewUrl = (item: SiteBackgroundImage) => backgroundImageUrl(item)

const sizeText = (item: SiteBackgroundImage) =>
  item.type === 'file' && item.size ? (item.size / 1024 / 1024).toFixed(2) + ' MB' : '外链'
</script>

<template>
  <div>
    <div class="d-flex flex-wrap align-center ga-3">
      <div class="me-auto text-h6">
        背景图 <small>( 已启用 {{ enabledCount }} / {{ images.length }} )</small>
      </div>

      <div class="d-flex align-center ga-4">
        <v-btn
          @click="refreshItems"
          :loading="loading"
          prepend-icon="mdi-refresh"
          variant="outlined"
          color="primary"
          >刷新</v-btn
        >
      </div>
    </div>

    <v-card class="mt-5" variant="outlined" title="显示设置">
      <v-card-text>
        <v-row>
          <v-col cols="12" md="3">
            <v-switch
              v-model="settings.enabled"
              color="primary"
              label="全站显示背景图"
              hide-details
              :disabled="saving"
            ></v-switch>
          </v-col>
          <v-col cols="12" md="4">
            <v-slider
              v-model="settings.opacity"
              :min="0"
              :max="100"
              :step="1"
              color="primary"
              label="不透明度"
              thumb-label
              :disabled="saving"
            >
              <template #append>
                <div style="width: 48px" class="text-right">{{ settings.opacity }}%</div>
              </template>
            </v-slider>
          </v-col>
          <v-col cols="12" md="4">
            <v-slider
              v-model="settings.blur"
              :min="0"
              :max="30"
              :step="1"
              color="primary"
              label="模糊"
              thumb-label
              :disabled="saving"
            >
              <template #append>
                <div style="width: 48px" class="text-right">{{ settings.blur }}px</div>
              </template>
            </v-slider>
          </v-col>
        </v-row>
        <div class="text-medium-emphasis text-caption">
          不透明度越低背景越淡，正文越清楚；有多张已启用的图片时，访客每次打开页面会随机看到其中一张。
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="primary" :loading="saving" @click="saveSettings">保存</v-btn>
      </v-card-actions>
    </v-card>

    <v-card class="mt-5" variant="outlined" title="添加背景图">
      <v-card-text>
        <v-row>
          <v-col cols="12" md="6">
            <v-textarea
              v-model="urlText"
              label="图片地址"
              placeholder="https://example.com/a.jpg&#10;https://example.com/b.jpg"
              rows="4"
              hide-details
              :disabled="adding"
            ></v-textarea>
            <div class="text-medium-emphasis text-caption mt-2">
              一行一个，支持 http(s) 开头的外链或站内绝对路径。
            </div>
            <v-btn class="mt-3" color="primary" :loading="adding" @click="addUrls">添加地址</v-btn>
          </v-col>
          <v-col cols="12" md="6">
            <v-file-input
              v-model="files"
              label="选择图片"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              multiple
              chips
              show-size
              prepend-icon="mdi-image-plus-outline"
              hide-details
              :disabled="uploading"
            ></v-file-input>
            <div class="text-medium-emphasis text-caption mt-2">
              支持 jpg / png / webp / gif / avif，单张不超过 10 MB，一次最多 5 张。
            </div>
            <v-btn class="mt-3" color="primary" :loading="uploading" @click="uploadFiles"
              >上传</v-btn
            >
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <v-card class="mt-5" variant="outlined" title="已有背景图">
      <v-card-text>
        <v-row v-if="images.length > 0">
          <v-col v-for="item in images" :key="item.id" cols="12" sm="6" md="4" lg="3">
            <v-card variant="outlined">
              <v-img :src="previewUrl(item)" height="150" cover>
                <template #error>
                  <div class="d-flex align-center justify-center h-100 text-medium-emphasis">
                    <v-icon icon="mdi-image-broken-variant" size="32"></v-icon>
                  </div>
                </template>
                <template #placeholder>
                  <div class="d-flex align-center justify-center h-100">
                    <v-progress-circular color="primary" indeterminate></v-progress-circular>
                  </div>
                </template>
              </v-img>
              <v-card-text class="py-2">
                <div class="d-flex align-center ga-2">
                  <v-chip size="x-small" :color="item.type === 'file' ? 'teal' : 'blue-grey'">
                    #{{ item.id }} {{ item.type === 'file' ? '上传' : '外链' }}
                  </v-chip>
                  <span class="text-caption text-medium-emphasis">{{ sizeText(item) }}</span>
                </div>
              </v-card-text>
              <v-card-actions class="pt-0">
                <v-switch
                  :model-value="item.enabled"
                  @update:model-value="toggle(item, !!$event)"
                  color="primary"
                  density="compact"
                  hide-details
                  label="启用"
                ></v-switch>
                <v-spacer></v-spacer>
                <v-btn
                  icon="mdi-open-in-new"
                  variant="text"
                  size="small"
                  color="primary"
                  :href="previewUrl(item)"
                  target="_blank"
                  rel="noopener"
                ></v-btn>
                <v-btn
                  icon="mdi-trash-can-outline"
                  variant="text"
                  size="small"
                  color="red"
                  @click="toDelete(item)"
                ></v-btn>
              </v-card-actions>
            </v-card>
          </v-col>
        </v-row>
        <div v-else class="text-medium-emphasis py-6 text-center">
          还没有背景图，先在上面添加地址或上传图片吧
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>