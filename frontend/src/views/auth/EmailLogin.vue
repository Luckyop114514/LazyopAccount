<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { indexStore } from '@/stores'
import { EmailLoginForm } from '@/types'
import type { VForm } from 'vuetify/lib/components/index.mjs'
import { sendEmailCodeApi, emailLoginApi } from '@/apis/auth'
import { userStore } from '@/stores/user'
import router from '@/router'
import { useRouteQuery } from '@vueuse/router'

const emit = defineEmits<{
  update: [type: 'title' | 'image', arg: string]
  reset: []
}>()
const { showMsg, isLogin } = indexStore()
const { info } = storeToRefs(userStore())
const redirectUrl = useRouteQuery('redirect')

const form = ref<InstanceType<typeof VForm>>()
const formData = ref<EmailLoginForm>({
  email: '',
  code: ''
})
const timer = ref<NodeJS.Timeout>()
const num = ref(-1)
const sendStatus = ref('')
const btnLoading = ref(false)

const sendEmailCode = async () => {
  if (timer.value) clearInterval(timer.value)
  num.value = -1
  btnLoading.value = true
  const { data, retryAfter } = await sendEmailCodeApi({
    email: formData.value.email,
    type: 'emailLogin'
  })
  btnLoading.value = false
  if (data.code !== 200) {
    sendStatus.value = data.msg
    showMsg(data.msg, 'red')
    emit('update', 'image', '035.png')
  } else {
    sendStatus.value = ''
    showMsg(data.msg, 'green')
    emit('update', 'image', '020.png')
  }
  num.value = retryAfter
  timer.value = setInterval(() => {
    num.value--
    if (num.value <= 0) {
      clearInterval(timer.value)
      emit('update', 'image', '020.png')
    }
  }, 1000)
}

const step = ref<Step>(1)
enum Step {
  EMAIL = 1,
  CODE
}

const STEP_ACTION = {
  [Step.EMAIL]: async () => {
    if (!formData.value.email) return
    if (!form.value) return
    const { valid } = await form.value.validate()
    if (!valid) return
    step.value++
    sendEmailCode()
  },
  [Step.CODE]: async () => {
    if (formData.value.code.length !== 6) return
    try {
      btnLoading.value = true
      const { msg, data } = await emailLoginApi(formData.value)
      showMsg(msg, 'green')
      info.value = data
      isLogin.value = true
      if (redirectUrl.value)
        return (window.location.href = decodeURIComponent(redirectUrl.value as string))
      router.replace('/user/info')
    } finally {
      btnLoading.value = false
    }
  }
}

const nextStep = async () => await STEP_ACTION[step.value]()

onUnmounted(() => {
  if (timer.value) clearInterval(timer.value)
  emit('reset')
})
</script>

<template>
  <v-form ref="form" fast-fail @submit.prevent>
    <v-slide-y-reverse-transition leave-absolute>
      <div
        v-if="step === Step.CODE && formData.email"
        class="mt-n3 d-flex flex-wrap justify-center ga-3"
      >
        <v-chip prepend-icon="mdi-email-outline" color="primary">
          {{ formData.email }}
        </v-chip>

        <v-chip v-if="num > 0 && sendStatus !== ''" prepend-icon="mdi-robot-angry-outline" color="error">
          你的操作太快了，请等待 {{ num }} 秒后重试
        </v-chip>
        <v-chip v-else-if="num > 0" prepend-icon="mdi-robot-happy-outline" color="success">
          已发送验证码，{{ num }} 秒后可重新发送
        </v-chip>
        <v-chip v-if="num === -1" prepend-icon="mdi-robot-outline" color="warning">
          验证码发送中...
        </v-chip>
      </div>
    </v-slide-y-reverse-transition>

    <v-slide-x-transition group leave-absolute>
      <v-text-field
        v-if="step === Step.EMAIL"
        v-model="formData.email"
        autofocus
        clearable
        :rules="[(v) => (v && v.length > 0 ? true : false)]"
        label="你的邮箱"
        type="email"
      ></v-text-field>

      <div v-if="step === Step.CODE">
        <v-otp-input
          v-model="formData.code"
          autofocus
          class="mb-1"
          :disabled="btnLoading"
          @finish="nextStep"
        ></v-otp-input>
      </div>
    </v-slide-x-transition>

    <v-row v-if="step === Step.EMAIL">
      <v-col cols="12" sm="6">
        <v-btn size="large" variant="text" color="warning" block to="/auth/login"
          >用密码登录</v-btn
        >
      </v-col>
      <v-col cols="12" sm="6">
        <v-btn
          size="large"
          color="primary"
          type="submit"
          block
          :loading="btnLoading"
          @click="nextStep"
          >发送验证码</v-btn
        >
      </v-col>
    </v-row>

    <v-row v-else>
      <v-col cols="12" sm="6">
        <v-row>
          <v-col cols="12" sm="6">
            <v-btn size="large" variant="text" color="warning" block @click="step--">上一步</v-btn>
          </v-col>
          <v-col cols="12" sm="6" v-if="num === 0">
            <v-btn size="large" variant="text" color="primary" block @click="sendEmailCode"
              >重新发送</v-btn
            >
          </v-col>
        </v-row>
      </v-col>
      <v-col cols="12" sm="6">
        <v-btn
          size="large"
          color="primary"
          type="submit"
          block
          :loading="btnLoading"
          @click="nextStep"
          >登录</v-btn
        >
      </v-col>
    </v-row>
  </v-form>
</template>
