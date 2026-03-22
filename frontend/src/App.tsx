import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Dashboard from '@/pages/Dashboard'
import Accounts from '@/pages/Accounts'
import Register from '@/pages/Register'
import Proxies from '@/pages/Proxies'
import Settings from '@/pages/Settings'
import TaskHistory from '@/pages/TaskHistory'
import { LayoutDashboard, Users, Globe, History,
         Settings as SettingsIcon, Sun, Moon, ChevronDown, ChevronRight } from 'lucide-react'

function AccountsSubNav() {
  const location = useLocation()
  const isAccounts = location.pathname.startsWith('/accounts')
  const [open, setOpen] = useState(isAccounts)
  const [platforms, setPlatforms] = useState<{ key: string; label: string }[]>([])
  useEffect(() => { if (isAccounts) setOpen(true) }, [isAccounts])
  useEffect(() => {
    fetch('/api/platforms').then(r => r.json()).then(d => setPlatforms((d || []).map((p: any) => ({ key: p.name, label: p.display_name }))))
  }, [])

  return (
    <div>
      <NavLink to="/accounts"
        style={({ isActive }) => ({
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
          fontSize: '0.875rem', textDecoration: 'none',
          transition: 'background 0.15s, color 0.15s',
          background: isActive ? 'var(--bg-active)' : 'transparent',
          color: isActive ? 'var(--text-accent)' : 'var(--text-secondary)',
        })}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Users style={{ width: '1rem', height: '1rem' }} />
          平台管理
        </div>
        <span onClick={e => { e.preventDefault(); setOpen(o => !o) }}
          style={{ padding: '0 0.1rem', cursor: 'pointer' }}>
          {open
            ? <ChevronDown style={{ width: '0.85rem', height: '0.85rem' }} />
            : <ChevronRight style={{ width: '0.85rem', height: '0.85rem' }} />}
        </span>
      </NavLink>
      {open && (
        <div style={{ marginLeft: '1.1rem', paddingLeft: '0.9rem', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.1rem', marginTop: '0.2rem', marginBottom: '0.2rem' }}>
          {platforms.map(p => (
            <NavLink key={p.key} to={`/accounts/${p.key}`}
              style={({ isActive }) => ({
                display: 'block', padding: '0.3rem 0.5rem',
                borderRadius: '0.375rem', fontSize: '0.8rem',
                textDecoration: 'none', transition: 'background 0.15s, color 0.15s',
                background: isActive ? 'var(--bg-active)' : 'transparent',
                color: isActive ? 'var(--text-accent)' : 'var(--text-secondary)',
              })}>
              {p.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

const NAV_TOP = [
  { path: '/', label: '仪表盘', icon: LayoutDashboard },
]
const NAV_BOTTOM = [
  { path: '/history',  label: '任务历史', icon: History },
  { path: '/proxies',  label: '代理管理', icon: Globe },
  { path: '/settings', label: '全局配置', icon: SettingsIcon },
]

function Sidebar({ theme, toggleTheme }: { theme: string; toggleTheme: () => void }) {
  const isLight = theme === 'light'
  const navStyle = (isActive: boolean) => ({
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
    fontSize: '0.875rem', textDecoration: 'none',
    transition: 'background 0.15s, color 0.15s',
    background: isActive ? 'var(--bg-active)' : 'transparent',
    color: isActive ? 'var(--text-accent)' : 'var(--text-secondary)',
  })
  return (
    <aside style={{
      width: '14rem', flexShrink: 0,
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-card)',
    }}>
      <div style={{ padding: '1.25rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <LayoutDashboard style={{ width: '1.1rem', height: '1.1rem', color: 'var(--accent)' }} />
          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>Account Manager</span>
        </div>
      </div>
      <nav style={{ flex: 1, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {NAV_TOP.map(({ path, label, icon: Icon }) => (
          <NavLink key={path} to={path} end
            style={({ isActive }) => navStyle(isActive)}>
            <Icon style={{ width: '1rem', height: '1rem' }} />
            {label}
          </NavLink>
        ))}
        <AccountsSubNav />
        {NAV_BOTTOM.map(({ path, label, icon: Icon }) => (
          <NavLink key={path} to={path}
            style={({ isActive }) => navStyle(isActive)}>
            <Icon style={{ width: '1rem', height: '1rem' }} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div style={{ padding: '1rem', borderTop: '1px solid var(--border)' }}>
        <button
          onClick={toggleTheme}
          style={{
            width: '100%', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
            border: '1px solid var(--border)',
            background: 'var(--bg-hover)', cursor: 'pointer',
            color: 'var(--text-secondary)', fontSize: '0.8rem',
            transition: 'background 0.15s',
          }}
        >
          <span>{isLight ? '亮色模式' : '暗色模式'}</span>
          {isLight
            ? <Sun style={{ width: '0.9rem', height: '0.9rem' }} />
            : <Moon style={{ width: '0.9rem', height: '0.9rem' }} />}
        </button>
      </div>
    </aside>
  )
}

export default function App() {
  const [theme, setTheme] = useState(() =>
    localStorage.getItem('theme') || 'dark'
  )

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  return (
    <BrowserRouter>
      <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-base)' }}>
        <Sidebar theme={theme} toggleTheme={toggleTheme} />
        <main style={{ flex: 1, overflow: 'auto', padding: '2rem' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/accounts/:platform" element={<Accounts />} />
            <Route path="/register" element={<Register />} />
            <Route path="/history" element={<TaskHistory />} />
            <Route path="/proxies" element={<Proxies />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
