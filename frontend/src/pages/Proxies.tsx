import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react'

export default function Proxies() {
  const [proxies, setProxies] = useState<any[]>([])
  const [newProxy, setNewProxy] = useState('')
  const [region, setRegion] = useState('')
  const [checking, setChecking] = useState(false)

  const load = () => apiFetch('/proxies').then(setProxies)

  useEffect(() => { load() }, [])

  const add = async () => {
    if (!newProxy.trim()) return
    const lines = newProxy.trim().split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length > 1) {
      await apiFetch('/proxies/bulk', {
        method: 'POST',
        body: JSON.stringify({ proxies: lines, region }),
      })
    } else {
      await apiFetch('/proxies', {
        method: 'POST',
        body: JSON.stringify({ url: lines[0], region }),
      })
    }
    setNewProxy('')
    load()
  }

  const del = async (id: number) => {
    await apiFetch(`/proxies/${id}`, { method: 'DELETE' })
    load()
  }

  const toggle = async (id: number) => {
    await apiFetch(`/proxies/${id}/toggle`, { method: 'PATCH' })
    load()
  }

  const check = async () => {
    setChecking(true)
    await apiFetch('/proxies/check', { method: 'POST' })
    setTimeout(() => { load(); setChecking(false) }, 3000)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">代理管理</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">共 {proxies.length} 个代理</p>
        </div>
        <Button variant="outline" size="sm" onClick={check} disabled={checking}>
          <RefreshCw className={`h-4 w-4 mr-1 ${checking ? 'animate-spin' : ''}`} />
          检测全部
        </Button>
      </div>

      {/* 添加代理 */}
      <Card>
        <p className="text-sm font-medium text-[var(--text-primary)] mb-3">添加代理（每行一个）</p>
        <div className="space-y-3">
          <textarea
            value={newProxy}
            onChange={e => setNewProxy(e.target.value)}
            placeholder="http://user:pass@host:port"
            rows={3}
            className="w-full bg-[var(--bg-hover)] border border-[var(--border)] text-[var(--text-primary)] rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-500 resize-none"
          />
          <div className="flex gap-2">
            <input
              value={region}
              onChange={e => setRegion(e.target.value)}
              placeholder="地区标签 (如 US, SG)"
              className="flex-1 bg-[var(--bg-hover)] border border-[var(--border)] text-[var(--text-primary)] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
            <Button onClick={add} size="sm">
              <Plus className="h-4 w-4 mr-1" /> 添加
            </Button>
          </div>
        </div>
      </Card>

      {/* 代理列表 */}
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
              <th className="px-4 py-3 text-left">代理地址</th>
              <th className="px-4 py-3 text-left">地区</th>
              <th className="px-4 py-3 text-left">成功/失败</th>
              <th className="px-4 py-3 text-left">状态</th>
              <th className="px-4 py-3 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {proxies.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--text-muted)]">暂无代理</td></tr>
            )}
            {proxies.map(p => (
              <tr key={p.id} className="border-b border-white/5 hover:bg-[var(--bg-hover)]">
                <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">{p.url}</td>
                <td className="px-4 py-3 text-[var(--text-muted)]">{p.region || '-'}</td>
                <td className="px-4 py-3">
                  <span className="text-emerald-400">{p.success_count}</span>
                  <span className="text-[var(--text-muted)]"> / </span>
                  <span className="text-red-400">{p.fail_count}</span>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={p.is_active ? 'success' : 'danger'}>
                    {p.is_active ? '活跃' : '禁用'}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggle(p.id)} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
                      {p.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                    </button>
                    <button onClick={() => del(p.id)} className="text-[var(--text-muted)] hover:text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
