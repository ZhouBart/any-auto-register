import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

export default function TaskHistory() {
  const [logs, setLogs] = useState<any[]>([])
  const [platform, setPlatform] = useState('')
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: '1', page_size: '50' })
      if (platform) params.set('platform', platform)
      const data = await apiFetch(`/tasks/logs?${params}`)
      setLogs(data.items || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [platform])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">任务历史</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">注册任务执行记录</p>
        </div>
        <div className="flex gap-2">
          <select
            value={platform}
            onChange={e => setPlatform(e.target.value)}
            className="bg-[var(--bg-hover)] border border-[var(--border)] text-[var(--text-secondary)] rounded-md px-3 py-1.5 text-sm"
          >
            <option value="">全部平台</option>
            <option value="trae">Trae</option>
            <option value="tavily">Tavily</option>
            <option value="cursor">Cursor</option>
          </select>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
              <th className="px-4 py-3 text-left">时间</th>
              <th className="px-4 py-3 text-left">平台</th>
              <th className="px-4 py-3 text-left">邮箱</th>
              <th className="px-4 py-3 text-left">状态</th>
              <th className="px-4 py-3 text-left">错误信息</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--text-muted)]">暂无记录</td></tr>
            )}
            {logs.map(log => (
              <tr key={log.id} className="border-b border-white/5 hover:bg-[var(--bg-hover)]">
                <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                  {new Date(log.created_at).toLocaleString('zh-CN')}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="secondary">{log.platform}</Badge>
                </td>
                <td className="px-4 py-3 text-[var(--text-secondary)] font-mono text-xs">{log.email}</td>
                <td className="px-4 py-3">
                  <Badge variant={log.status === 'success' ? 'success' : 'danger'}>
                    {log.status === 'success' ? '成功' : '失败'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs text-red-400">{log.error || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
