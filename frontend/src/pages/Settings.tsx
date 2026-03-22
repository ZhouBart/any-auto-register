import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Save, Eye, EyeOff, Mail, Shield, Cpu, RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const SELECT_FIELDS: Record<string, { label: string; value: string }[]> = {
  mail_provider: [
    { label: 'Laoudo（固定邮箱）', value: 'laoudo' },
    { label: 'TempMail.lol（自动生成）', value: 'tempmail_lol' },
    { label: 'DuckMail（自动生成）', value: 'duckmail' },
    { label: 'MoeMail (sall.cc)', value: 'moemail' },
    { label: 'Freemail（自建 CF Worker）', value: 'freemail' },
    { label: 'CF Worker（自建域名）', value: 'cfworker' },
  ],
  default_executor: [
    { label: 'API 协议（无浏览器）', value: 'protocol' },
    { label: '无头浏览器', value: 'headless' },
    { label: '有头浏览器（调试用）', value: 'headed' },
  ],
  default_captcha_solver: [
    { label: 'YesCaptcha', value: 'yescaptcha' },
    { label: '2Captcha', value: '2captcha' },
    { label: '本地 Solver (Camoufox)', value: 'local_solver' },
    { label: '手动', value: 'manual' },
  ],
}

const TABS = [
  {
    id: 'register', label: '注册设置', icon: Cpu,
    sections: [{
      section: '默认注册方式',
      desc: '控制注册任务如何执行',
      items: [
        { key: 'default_executor', label: '执行器类型' },
      ],
    }],
  },
  {
    id: 'mailbox', label: '邮箱服务', icon: Mail,
    sections: [{
      section: '默认邮箱服务',
      desc: '选择注册时使用的邮箱类型',
      items: [
        { key: 'mail_provider', label: '邮箱服务' },
      ],
    }, {
      section: 'Laoudo',
      desc: '固定邮箱，手动配置',
      items: [
        { key: 'laoudo_email', label: '邮箱地址', placeholder: 'xxx@laoudo.com' },
        { key: 'laoudo_account_id', label: 'Account ID', placeholder: '563' },
        { key: 'laoudo_auth', label: 'JWT Token', placeholder: 'eyJ...', secret: true },
      ],
    }, {
      section: 'Freemail',
      desc: '基于 Cloudflare Worker 的自建邮箱，支持管理员令牌或账号密码认证',
      items: [
        { key: 'freemail_api_url', label: 'API URL', placeholder: 'https://mail.example.com' },
        { key: 'freemail_admin_token', label: '管理员令牌', secret: true },
        { key: 'freemail_username', label: '用户名（可选）', placeholder: '' },
        { key: 'freemail_password', label: '密码（可选）', secret: true },
      ],
    }, {
      section: 'MoeMail',
      desc: '自动注册账号并生成临时邮箱，默认无需配置',
      items: [
        { key: 'moemail_api_url', label: 'API URL', placeholder: 'https://sall.cc' },
      ],
    }, {
      section: 'TempMail.lol',
      desc: '自动生成邮箱，无需配置，需要代理访问（CN IP 被封）',
      items: [],
    }, {
      section: 'DuckMail',
      desc: '自动生成邮箱，随机创建账号（默认无需配置）',
      items: [
        { key: 'duckmail_api_url', label: 'Web URL', placeholder: 'https://www.duckmail.sbs' },
        { key: 'duckmail_provider_url', label: 'Provider URL', placeholder: 'https://api.duckmail.sbs' },
        { key: 'duckmail_bearer', label: 'Bearer Token', placeholder: 'kevin273945', secret: true },
      ],
    }, {
      section: 'CF Worker 自建邮箱',
      desc: '基于 Cloudflare Worker 的自建临时邮箱服务',
      items: [
        { key: 'cfworker_api_url', label: 'API URL', placeholder: 'https://apimail.example.com' },
        { key: 'cfworker_admin_token', label: '管理员 Token', secret: true },
        { key: 'cfworker_domain', label: '邮箱域名', placeholder: 'example.com' },
        { key: 'cfworker_fingerprint', label: 'Fingerprint', placeholder: '6703363b...' },
      ],
    }],
  },
  {
    id: 'captcha', label: '验证码', icon: Shield,
    sections: [{
      section: '验证码服务',
      desc: '用于绕过注册页面的人机验证',
      items: [
        { key: 'default_captcha_solver', label: '默认服务' },
        { key: 'yescaptcha_key', label: 'YesCaptcha Key', secret: true },
        { key: 'twocaptcha_key', label: '2Captcha Key', secret: true },
      ],
    }],
  },
  {
    id: 'chatgpt', label: 'ChatGPT', icon: Shield,
    sections: [{
      section: 'CPA 面板',
      desc: '注册完成后自动上传到 CPA 管理平台',
      items: [
        { key: 'cpa_api_url', label: 'API URL', placeholder: 'https://your-cpa.example.com' },
        { key: 'cpa_api_key', label: 'API Key', secret: true },
      ],
    }, {
      section: 'Team Manager',
      desc: '上传到自建 Team Manager 系统',
      items: [
        { key: 'team_manager_url', label: 'API URL', placeholder: 'https://your-tm.example.com' },
        { key: 'team_manager_key', label: 'API Key', secret: true },
      ],
    }],
  },
]

function Field({ field, form, setForm, showSecret, setShowSecret }: any) {
  const { key, label, placeholder, secret } = field
  const options = SELECT_FIELDS[key]
  return (
    <div className="grid grid-cols-3 gap-4 items-center py-3 border-b border-white/5 last:border-0">
      <label className="text-sm text-[var(--text-secondary)] font-medium">{label}</label>
      <div className="col-span-2 relative">
        {options ? (
          <select
            value={form[key] || options[0].value}
            onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
            className="w-full bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 appearance-none"
          >
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <>
            <input
              type={secret && !showSecret[key] ? 'password' : 'text'}
              value={form[key] || ''}
              onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
              placeholder={placeholder}
              className="w-full bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-primary)] rounded-lg px-3 py-2 text-sm pr-10 focus:outline-none focus:border-indigo-500 placeholder:text-[var(--text-muted)]"
            />
            {secret && (
              <button
                onClick={() => setShowSecret((s: any) => ({ ...s, [key]: !s[key] }))}
                className="absolute right-3 top-2.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              >
                {showSecret[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState('register')
  const [form, setForm] = useState<Record<string, string>>({})
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [solverRunning, setSolverRunning] = useState<boolean | null>(null)

  useEffect(() => { apiFetch('/config').then(setForm) }, [])

  const checkSolver = async () => {
    try { const d = await apiFetch('/solver/status'); setSolverRunning(d.running) }
    catch { setSolverRunning(false) }
  }
  const restartSolver = async () => {
    await apiFetch('/solver/restart', { method: 'POST' })
    setSolverRunning(null)
    setTimeout(checkSolver, 4000)
  }
  useEffect(() => { checkSolver() }, [])

  const save = async () => {
    setSaving(true)
    try {
      await apiFetch('/config', { method: 'PUT', body: JSON.stringify({ data: form }) })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  const tab = TABS.find(t => t.id === activeTab)!

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">全局配置</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">配置将持久化保存，注册任务自动使用</p>
      </div>

      <div className="flex gap-6">
        {/* Left nav */}
        <div className="w-44 shrink-0 space-y-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                activeTab === id
                  ? 'bg-indigo-600/20 text-[var(--text-accent)] font-medium'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
              )}>
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}

          {/* Solver status */}
          <div className="mt-4 pt-4 border-t border-[var(--border)]">
            <p className="text-xs text-[var(--text-muted)] px-3 mb-2">Turnstile Solver</p>
            <div className="px-3 flex items-center gap-2">
              {solverRunning === null
                ? <RefreshCw className="h-3 w-3 animate-spin text-[var(--text-muted)]" />
                : solverRunning
                  ? <CheckCircle className="h-3 w-3 text-emerald-400" />
                  : <XCircle className="h-3 w-3 text-red-400" />}
              <span className={cn('text-xs', solverRunning ? 'text-emerald-400' : 'text-[var(--text-muted)]')}>
                {solverRunning === null ? '检测中' : solverRunning ? '运行中' : '未运行'}
              </span>
            </div>
            <button onClick={restartSolver}
              className="mt-2 w-full text-xs px-3 py-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg text-left">
              重启 Solver
            </button>
          </div>
        </div>

        {/* Right content */}
        <div className="flex-1 space-y-4">
          {tab.sections.map(({ section, desc, items }) => (
            <div key={section} className="bg-white/[0.03] border border-[var(--border)] rounded-xl p-5">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">{section}</h3>
                {desc && <p className="text-xs text-[var(--text-muted)] mt-0.5">{desc}</p>}
              </div>
              {items.map((field: any) => (
                <Field key={field.key} field={field} form={form} setForm={setForm}
                  showSecret={showSecret} setShowSecret={setShowSecret} />
              ))}
            </div>
          ))}

          <Button onClick={save} disabled={saving} className="w-full">
            <Save className="h-4 w-4 mr-2" />
            {saved ? '已保存 ✓' : saving ? '保存中...' : '保存配置'}
          </Button>
        </div>
      </div>
    </div>
  )
}
