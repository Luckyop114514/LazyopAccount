<script lang="ts" setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { avatarUrl, delAvatarApi, uploadAvatarApi } from '@/apis/user'
import { indexStore } from '@/stores'
import { userStore } from '@/stores/user'

// 与后端 user.avatar.service.ts 里的限制保持一致
const MAX_FILE_SIZE = 2 * 1024 * 1024
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif'

const open = ref(false)
const openDialog = () => {
  open.value = true
}

const { showMsg, openConfirmDialog } = indexStore()
const { getUserInfo } = userStore()
const { info } = storeToRefs(userStore())

const files = ref<File[]>([])
const previewURL = ref('')
const btnLoading = ref(false)
const delLoading = ref(false)

// v-file-input 在不同版本里可能给数组也可能给单个文件，这里统一取第一个
const picked = computed<File | undefined>(() =>
  Array.isArray(files.value) ? files.value[0] : files.value
)

// 有没有在用自定义头像
const isCustom = computed(() => !!info.value?.avatar)

// 预览优先显示刚选中的图片，没选就显示当前头像
const preview = computed(() => previewURL.value || avatarUrl(info.value))

const revoke = () => {
  if (previewURL.value) URL.revokeObjectURL(previewURL.value)
  previewURL.value = ''
}

watch(picked, (file) => {
  revoke()
  if (file) previewURL.value = URL.createObjectURL(file)
})

onUnmounted(revoke)

const handleOk = async () => {
  const file = picked.value
  if (!file) return showMsg('请先选择图片', 'red')
  if (file.size > MAX_FILE_SIZE) return showMsg('图片不能超过 2 MB', 'red')

  try {
    btnLoading.value = true
    const { msg } = await uploadAvatarApi(file)
    await getUserInfo()
    showMsg(msg, 'green')
    handleCancel()
  } finally {
    btnLoading.value = false
  }
}

// 删掉自定义头像，回落到根据邮箱生成的默认头像
const handleReset = async () => {
  try {
    await openConfirmDialog('提示', '确定要恢复成默认头像吗？')
    delLoading.value = true
    const { msg } = await delAvatarApi()
    await getUserInfo()
    showMsg(msg, 'green')
    handleCancel()
  } catch (err: any) {
    console.error(err)
  } finally {
    delLoading.value = false
  }
}

const handleCancel = () => {
  revoke()
  files.value = []
  open.value = false
}

defineExpose({
  openDialog
})
</script>

<template>
  <v-dialog v-model="open" max-width="400" persistent>
    <v-card title="更换头像" variant="flat">
      <v-card-text class="py-0 pt-5">
        <div class="text-center mb-4">
          <v-avatar size="120">
            <v-img :src="preview" :alt="info?.username" cover>
              <template #error>
                <div class="d-flex align-center justify-center h-100 text-medium-emphasis">
                  <v-icon icon="mdi-account-circle" size="64"></v-icon>
                </div>
              </template>
            </v-img>
          </v-avatar>
        </div>
        <v-file-input
          v-model="files"
          :accept="ACCEPT"
          :disabled="btnLoading || delLoading"
          label="选择图片"
          prepend-icon="mdi-image-plus-outline"
          hide-details
          show-size
        ></v-file-input>
        <small class="d-block mt-3">
          支持 jpg / png / webp / gif / avif，不超过 2 MB。<br />
          不设置自定义头像时，会按邮箱自动生成一个默认头像。
        </small>
      </v-card-text>
      <v-card-actions>
        <v-btn v-if="isCustom" color="red" :loading="delLoading" @click="handleReset">
          恢复默认
        </v-btn>
        <v-spacer></v-spacer>
        <v-btn @click="handleCancel"> 取消 </v-btn>

        <v-btn @click="handleOk" color="primary" :loading="btnLoading"> 确定 </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>