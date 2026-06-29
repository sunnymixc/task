<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import type { LoginRequest } from '@/types'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const form = reactive<LoginRequest>({
  email: '',
  password: ''
})

const loading = ref(false)
const showPassword = ref(false)

const formRules = {
  email: [
    { required: true, message: '请输入邮箱' },
    { email: true, message: '请输入正确的邮箱格式' }
  ],
  password: [
    { required: true, message: '请输入密码' },
    { min: 6, message: '密码至少6个字符', type: 'warning' }
  ]
}

const handleSubmit = async () => {
  const valid = await formRef.value.validate()
  if (valid !== true) return

  loading.value = true
  const success = await authStore.login(form)
  loading.value = false

  if (success) {
    const redirect = route.query.redirect as string || '/tasks'
    router.push(redirect)
  }
}

const goToRegister = () => {
  router.push('/register')
}
</script>

<template>
  <div class="login-container">
    <div class="login-box">
      <h1 class="title">任务管理系统</h1>
      <p class="subtitle">登录您的账户</p>

      <t-form
        ref="formRef"
        :data="form"
        :rules="formRules"
        label-width="0"
        @submit="handleSubmit"
      >
        <t-form-item name="email">
          <t-input
            v-model="form.email"
            placeholder="请输入邮箱"
            type="email"
            clearable
            size="large"
          >
            <template #prefix-icon>
              <t-icon name="mail" />
            </template>
          </t-input>
        </t-form-item>

        <t-form-item name="password">
          <t-input
            v-model="form.password"
            placeholder="请输入密码"
            :type="showPassword ? 'text' : 'password'"
            clearable
            size="large"
          >
            <template #prefix-icon>
              <t-icon name="lock-on" />
            </template>
            <template #suffix-icon>
              <t-icon
                :name="showPassword ? 'view' : 'view-off'"
                style="cursor: pointer"
                @click="showPassword = !showPassword"
              />
            </template>
          </t-input>
        </t-form-item>

        <t-form-item>
          <t-button
            theme="primary"
            type="submit"
            size="large"
            :loading="loading"
            block
          >
            登录
          </t-button>
        </t-form-item>

        <div class="footer-links">
          <span>还没有账户？</span>
          <t-link theme="primary" @click="goToRegister">立即注册</t-link>
        </div>
      </t-form>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-box {
  width: 400px;
  padding: 40px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
}

.title {
  font-size: 28px;
  font-weight: 600;
  text-align: center;
  margin-bottom: 8px;
  color: #333;
}

.subtitle {
  font-size: 14px;
  color: #666;
  text-align: center;
  margin-bottom: 32px;
}

.footer-links {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  font-size: 14px;
  color: #666;
}

.footer-links a {
  cursor: pointer;
}
</style>
