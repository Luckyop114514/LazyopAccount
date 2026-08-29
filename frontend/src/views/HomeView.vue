<script setup lang="ts">
import { indexStore } from '@/stores'
import { useDisplay } from 'vuetify'

const { isLogin } = indexStore()
const { xs } = useDisplay()
</script>

<template>
  <v-row class="h-100" justify="center" align="center" no-gutters>
    <v-col cols="12" md="8" sm="10" xs="12" align-self="center">
      <v-card align="center">
        <v-card-title>
          <v-img
            alt="Logo"
            :width="200"
            src="/img/nya/023.png"
          />
          <div
            style="transition: all 0.5s"
            class="text-primary"
            :class="xs ? 'text-h4' : 'text-h3'"
          >
            Lazyop Account
          </div>
        </v-card-title>
        <v-card-text>
          <div class="mt-4">
            <p class="my-5">一个提供基于 OAuth2.0 标准协议的账号快捷登录服务平台</p>
            <v-btn
              v-if="isLogin"
              prepend-icon="mdi-cat"
              color="primary"
              variant="tonal"
              size="large"
              to="/user/info"
              >用户中心</v-btn
            >
            <v-btn
              v-else
              prepend-icon="mdi-cat"
              color="primary"
              variant="tonal"
              size="large"
              to="/auth"
              >开始使用</v-btn
            >
          </div>
        </v-card-text>
        <v-card-actions class="d-flex justify-center">
          <v-btn
            prepend-icon="mdi-github"
            href="https://github.com/Luckyop114514/LazyopAccount"
            target="_blank"
            >Github</v-btn
          >
          <v-btn
            prepend-icon="mdi-file-document-outline"
            color="primary"
            href="https://github.com/Luckyop114514/LazyopAccount/blob/main/wiki.md"
            target="_blank"
            >使用文档</v-btn
          >
          <v-btn
            prepend-icon="mdi-bug-outline"
            color="brown"
            href="https://github.com/Luckyop114514/LazyopAccount/issues"
            target="_blank"
            >问题反馈</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-col>
  </v-row>
</template>
