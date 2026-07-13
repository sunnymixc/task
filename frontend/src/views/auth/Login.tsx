import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Button, Form, Typography } from '@douyinfe/semi-ui-19'
import { IconLock, IconMail } from '@douyinfe/semi-icons'
import { useAuthStore } from '@/stores/auth'
import type { LoginRequest } from '@/types'
import styles from './auth.module.css'

export default function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(false)

  // Semi Form 校验通过后才会触发 onSubmit
  const handleSubmit = async (values: Record<string, unknown>) => {
    setLoading(true)
    const success = await useAuthStore.getState().login(values as unknown as LoginRequest)
    setLoading(false)

    if (success) {
      const redirect = searchParams.get('redirect') || '/tasks'
      navigate(redirect)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.box}>
        <h1 className={styles.title}>TASK</h1>
        <p className={styles.subtitle}>登录您的账户</p>

        <Form onSubmit={handleSubmit} disabled={loading}>
          <Form.Input
            field="email"
            noLabel
            size="large"
            placeholder="请输入邮箱"
            showClear
            prefix={<IconMail />}
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入正确的邮箱格式' }
            ]}
          />
          <Form.Input
            field="password"
            noLabel
            size="large"
            placeholder="请输入密码"
            mode="password"
            prefix={<IconLock />}
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少6个字符' }
            ]}
          />
          <div className={styles.submitRow}>
            <Button htmlType="submit" theme="solid" type="primary" size="large" loading={loading} block>
              登录
            </Button>
          </div>

          <div className={styles.footerLinks}>
            <span>还没有账户？</span>
            <Typography.Text link={{ onClick: () => navigate('/register') }}>立即注册</Typography.Text>
          </div>
        </Form>
      </div>
    </div>
  )
}
