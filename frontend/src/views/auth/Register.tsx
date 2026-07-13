import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button, Form, Typography } from '@douyinfe/semi-ui-19'
import { IconLock, IconMail, IconUser } from '@douyinfe/semi-icons'
import { useAuthStore } from '@/stores/auth'
import type { RegisterRequest } from '@/types'
import styles from './auth.module.css'

export default function Register() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (values: Record<string, unknown>) => {
    setLoading(true)
    const success = await useAuthStore.getState().register(values as unknown as RegisterRequest)
    setLoading(false)

    if (success) {
      navigate('/tasks')
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.box}>
        <h1 className={styles.title}>TASK</h1>
        <p className={styles.subtitle}>创建新账户</p>

        <Form onSubmit={handleSubmit} disabled={loading}>
          <Form.Input
            field="username"
            noLabel
            size="large"
            placeholder="请输入用户名"
            showClear
            prefix={<IconUser />}
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, max: 100, message: '用户名长度应为3-100个字符' }
            ]}
          />
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
              { min: 6, max: 100, message: '密码长度应为6-100个字符' }
            ]}
          />
          <div className={styles.submitRow}>
            <Button htmlType="submit" theme="solid" type="primary" size="large" loading={loading} block>
              注册
            </Button>
          </div>

          <div className={styles.footerLinks}>
            <span>已有账户？</span>
            <Typography.Text link={{ onClick: () => navigate('/login') }}>立即登录</Typography.Text>
          </div>
        </Form>
      </div>
    </div>
  )
}
