<script lang="ts" setup>
import { ref } from 'vue'
import { indexStore } from '@/stores'
import { useDisplay } from 'vuetify'
import type { VForm } from 'vuetify/lib/components/index.mjs'
import _ from 'lodash'
import { updateMyOAuth2AppApi, newOAuth2AppApi } from '@/apis/oauth2'
import { OAuth2ClientInfo, OauthProtocol } from '@/types'

const emit = defineEmits(['update'])
const { xs } = useDisplay()
const btnLoading = ref(false)
const { showMsg } = indexStore()
const form = ref<InstanceType<typeof VForm>>()
const emptyForm = (): OAuth2ClientInfo => ({
  id: 0,
  userId: 0,
  name: '',
  secret: '',
  redirect: '',
  protocol: 'oauth2',
  createdAt: new Date(),
  updatedAt: new Date()
})
const formData = ref<OAuth2ClientInfo>(emptyForm())
const open = ref(false)
const isEditMode = ref(false)

const protocols: { title: string; subtitle: string; value: OauthProtocol }[] = [
  {
    title: 'OAuth 2.0',
    subtitle: '只发 access_token，自己调 userinfo 拿用户信息',
    value: 'oauth2'
  },
  {
    title: 'OpenID Connect',
    subtitle: '额外签发 id_token，可被标准 OIDC 客户端自动发现',
    value: 'oidc'
  }
]

const discoveryUrl = `${window.location.origin}/.well-known/openid-configuration`

const openDialog = (appInfo?: OAuth2ClientInfo) => {
  open.value = true
  if (appInfo) {
    formData.value = _.cloneDeep(appInfo)
    // 老应用的 protocol 可能是空的，按 oauth2 显示
    formData.value.protocol = formData.value.protocol === 'oidc' ? 'oidc' : 'oauth2'
    isEditMode.value = true
  } else {
    formData.value = emptyForm()
    isEditMode.value = false
  }
}

const handleOk = async () => {
  try {
    if (!form.value) return
    const { valid } = await form.value.validate()
    if (!valid) return
    btnLoading.value = true
    const { msg } = isEditMode.value
      ? await updateMyOAuth2AppApi(formData.value)
      : await newOAuth2AppApi(formData.value)
    showMsg(msg, 'green')
    emit('update')
    handleCancel()
  } finally {
    btnLoading.value = false
  }
}

const handleCancel = async () => {
  open.value = false
  form.value?.reset()
}

defineExpose({
  openDialog
})
</script>

<template>
  <v-dialog v-model="open" max-width="500" persistent>
    <v-card :title="(isEditMode ? '编辑' : '新增') + ' OAuth2 应用'" variant="flat">
      <v-card-text class="py-0 pt-5">
        <v-form ref="form" fast-fail @submit.prevent>
          <!-- density="compact" -->
          <v-text-field
            v-model="formData.name"
            :rules="[(v) => (v && v.length > 0 ? true : false)]"
            clearable
            label="名称"
            :disabled="btnLoading"
          >
          </v-text-field>
          <v-text-field
            v-model="formData.redirect"
            :rules="[(v) => (v && v.length > 0 ? true : false)]"
            clearable
            label="回调 Url"
            :disabled="btnLoading"
          >
          </v-text-field>
          <v-select
            v-model="formData.protocol"
            :items="protocols"
            item-title="title"
            item-value="value"
            label="协议"
            :disabled="btnLoading"
          >
            <template v-slot:item="{ props, item }">
              <v-list-item v-bind="props" :subtitle="item.raw.subtitle"></v-list-item>
            </template>
          </v-select>
          <v-alert
            v-if="formData.protocol === 'oidc'"
            type="info"
            variant="tonal"
            density="compact"
            class="mb-4"
          >
            客户端可用发现地址自动配置：<br />
            <span class="text-caption">{{ discoveryUrl }}</span>
          </v-alert>
          <v-row :no-gutters="xs" v-if="isEditMode">
            <v-col cols="12" xs="12" sm="6">
              <v-text-field
                :model-value="new Date(formData.createdAt).toLocaleString()"
                readonly
                label="创建日期"
              ></v-text-field>
            </v-col>
            <v-col cols="12" xs="12" sm="6">
              <v-text-field
                :model-value="new Date(formData.updatedAt).toLocaleString()"
                readonly
                label="最后更新"
              ></v-text-field>
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn @click="handleCancel"> 取消 </v-btn>

        <v-btn @click="handleOk" color="primary" :loading="btnLoading"> 确定 </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
