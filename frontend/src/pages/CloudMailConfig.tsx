// 文件: frontend/src/pages/CloudMailConfig.tsx

import { Form, Input, InputNumber, Button, Space, message, Spin, Card } from 'antd'
import { MailOutlined } from '@ant-design/icons'
import { useState, useEffect } from 'react'

interface CloudMailConfigProps {
  data: any
  onSave: (values: any) => Promise<void>
}

export default function CloudMailConfig({ data, onSave }: CloudMailConfigProps) {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    form.setFieldsValue({
      cloud_mail_base_url: data?.cloud_mail_base_url || '',
      cloud_mail_admin_email: data?.cloud_mail_admin_email || '',
      cloud_mail_admin_password: data?.cloud_mail_admin_password || '',
      cloud_mail_domain: data?.cloud_mail_domain || '',
      cloud_mail_subdomain: data?.cloud_mail_subdomain || '',
      cloud_mail_timeout: data?.cloud_mail_timeout ? parseInt(data.cloud_mail_timeout) : 30,
    })
  }, [data, form])

  const handleSave = async (values: any) => {
    setLoading(true)
    try {
      await onSave(values)
      message.success('Cloud Mail 配置已保存')
    } catch (error: any) {
      message.error(`保存失败: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const response = await fetch('/api/email-services/cloud-mail/health', {
        method: 'POST',
      })
      const result = await response.json()

      if (result.healthy) {
        message.success('✅ Cloud Mail 连接成功！')
      } else {
        message.error(`❌ Cloud Mail 连接失败: ${result.error || '未知错误'}`)
      }
    } catch (error: any) {
      message.error(`测试失败: ${error.message}`)
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card title={<><MailOutlined /> Cloud Mail 邮箱服务</>} bordered={false}>
      <Spin spinning={loading}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          autoComplete="off"
        >
          <Form.Item
            label="API 基础地址"
            name="cloud_mail_base_url"
            rules={[
              { required: true, message: '请输入 API 基础地址' },
              { type: 'url', message: '请输入有效的 URL' },
            ]}
            tooltip="Cloudflare Worker 或自部署服务的 API 地址，例如: https://your-domain.workers.dev"
          >
            <Input placeholder="https://your-cloudflare-worker-url" />
          </Form.Item>

          <Form.Item
            label="管理员邮箱"
            name="cloud_mail_admin_email"
            tooltip="可选，如不提供会自动生成"
          >
            <Input type="email" placeholder="admin@example.com" />
          </Form.Item>

          <Form.Item
            label="管理员密码"
            name="cloud_mail_admin_password"
            rules={[{ required: true, message: '请输入管理员密码' }]}
            tooltip="用于生成 API Token"
          >
            <Input.Password placeholder="输入管理员密码" />
          </Form.Item>

          <Form.Item
            label="邮箱域名"
            name="cloud_mail_domain"
            tooltip="可以是单个域名 (example.com) 或多个域名 (逗号分隔)"
          >
            <Input placeholder="example.com 或 domain1.com,domain2.com" />
          </Form.Item>

          <Form.Item
            label="子域名（可选）"
            name="cloud_mail_subdomain"
            tooltip="邮箱前缀，例如: register.example.com"
          >
            <Input placeholder="register" />
          </Form.Item>

          <Form.Item
            label="超时时间（秒）"
            name="cloud_mail_timeout"
            tooltip="获取验证码的超时时间"
          >
            <InputNumber min={10} max={600} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                保存配置
              </Button>
              <Button onClick={handleTest} loading={testing}>
                测试连接
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Spin>
    </Card>
  )
}
