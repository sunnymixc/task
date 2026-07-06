<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import type { RegisterRequest } from '@/types'
import type { FormRules } from 'tdesign-vue-next'

const router = useRouter()
const authStore = useAuthStore()

const form = reactive<RegisterRequest>({
  username: '',
  email: '',
  password: ''
})

const loading = ref(false)
const showPassword = ref(false)
const formRef = ref()

const formRules: FormRules = {
  username: [
    { required: true, message: '请输入用户名' },
    { min: 3, max: 100, message: '用户名长度应为3-100个字符', type: 'warning' }
  ],
  email: [
    { required: true, message: '请输入邮箱' },
    { email: true, message: '请输入正确的邮箱格式' }
  ],
  password: [
    { required: true, message: '请输入密码' },
    { min: 6, max: 100, message: '密码长度应为6-100个字符', type: 'warning' }
  ]
}

const handleSubmit = async () => {
  const valid = await formRef.value.validate()
  if (valid !== true) return

  loading.value = true
  const success = await authStore.register(form)
  loading.value = false

  if (success) {
    router.push('/tasks')
  }
}

const goToLogin = () => {
  router.push('/login')
}
</script>

<template>
  <div class="register-container">
    <div class="register-box">
      <h1 class="title">TASK</h1>
      <p class="subtitle">创建新账户</p>

      <t-form
        ref="formRef"
        :data="form"
        :rules="formRules"
        label-width="0"
        @submit="handleSubmit"
      >
        <t-form-item name="username">
          <t-input
            v-model="form.username"
            placeholder="请输入用户名"
            clearable
            size="large"
          >
            <template #prefix-icon>
              <t-icon name="user" />
            </template>
          </t-input>
        </t-form-item>

        <t-form-item name="email">
          <t-input
            v-model="form.email"
            placeholder="请输入邮箱"
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
            注册
          </t-button>
        </t-form-item>

        <div class="footer-links">
          <span>已有账户？</span>
          <t-link theme="primary" @click="goToLogin">立即登录</t-link>
        </div>
      </t-form>
    </div>
  </div>
</template>

<style scoped>
.register-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #fff 60%, var(--td-brand-color-1) 100%);
}

.register-box {
  width: 400px;
  padding: 40px;
  background: white;
  border-radius: var(--td-radius-default);
  box-shadow: 0 0 2px 2px rgba(0, 0, 0, 0.025);
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
