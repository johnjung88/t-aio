'use client'
import { useEffect, useState } from 'react'
import type { Account, EngagementTask, StrategyConfig } from '@/lib/types'

const ACTION_LABELS: Record<string, string> = { comment: '댓글', like: '좋아요', follow: '팔로우' }
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: '대기', color: 'var(--orange)' },
  completed: { label: '완료', color: 'var(--mint)' },
  failed: { label: '실패', color: 'var(--red, #ef4444)' },
}

export default function EngagementPage() {
  const [tasks, setTasks] = useState<EngagementTask[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [strategy, setStrategy] = useState<StrategyConfig | null>(null)
  const [keyword, setKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<{ url: string; username: string; text: string }[]>([])
  const [searching, setSearching] = useState(false)
  const [executing, setExecuting] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/engagement').then(r => r.json()),
      fetch('/api/accounts').then(r => r.json()),
      fetch('/api/strategy').then(r => r.json()),
    ]).then(([engRes, accRes, strRes]) => {
      setTasks(engRes.data ?? [])
      const accs = accRes.data ?? []
      setAccounts(accs)
      if (accs.length > 0) setSelectedAccount(accs[0].id)
      setStrategy(strRes.data ?? null)
    }).catch(() => {})
  }, [])

  const today = new Date().toISOString().slice(0, 10)
  const todayTasks = tasks.filter(t => t.createdAt?.startsWith(today))
  const todayCompleted = todayTasks.filter(t => t.status === 'completed')
  const pendingTasks = tasks.filter(t => t.status === 'pending')

  const commentCount = todayCompleted.filter(t => t.action === 'comment').length
  const likeCount = todayCompleted.filter(t => t.action === 'like').length
  const followCount = todayCompleted.filter(t => t.action === 'follow').length

  async function handleSearch() {
    if (!keyword || !selectedAccount) return
    setSearching(true)
    try {
      const res = await fetch('/api/engagement/find-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: selectedAccount, keyword, limit: 10 }),
      }).then(r => r.json())
      setSearchResults(res.data?.posts ?? [])
    } catch { setSearchResults([]) }
    setSearching(false)
  }

  async function handleAddTask(action: 'comment' | 'like' | 'follow', targetUrl: string, targetUsername?: string) {
    await fetch('/api/engagement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: selectedAccount, action, targetUrl, targetUsername }),
    })
    const res = await fetch('/api/engagement').then(r => r.json())
    setTasks(res.data ?? [])
  }

  async function handleExecute() {
    if (!selectedAccount) return
    setExecuting(true)
    try {
      await fetch('/api/engagement/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: selectedAccount, limit: 5 }),
      })
      const res = await fetch('/api/engagement').then(r => r.json())
      setTasks(res.data ?? [])
    } catch {}
    setExecuting(false)
  }

  return (
    <div style={{ maxWidth: 960 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>인게이지먼트 엔진</h1>
      <p style={{ fontSize: 13, color: 'var(--text-s)', marginBottom: 24 }}>타인 포스트 댓글/좋아요/팔로우 자동화</p>

      {/* 계정 선택 */}
      <div style={{ marginBottom: 20 }}>
        <select value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: 13 }}>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.displayName} (@{a.username})</option>)}
        </select>
      </div>

      {/* 오늘의 현황 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: '댓글', count: commentCount, target: strategy?.dailyCommentTarget ?? 10, color: 'var(--primary)' },
          { label: '좋아요', count: likeCount, target: strategy?.dailyLikeTarget ?? 20, color: 'var(--mint)' },
          { label: '팔로우', count: followCount, target: strategy?.dailyFollowTarget ?? 5, color: 'var(--orange)' },
        ].map(({ label, count, target, color }) => (
          <div key={label} className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-s)', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color }}>{count}<span style={{ fontSize: 13, color: 'var(--text-s)' }}> / {target}</span></div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginTop: 8 }}>
              <div style={{ height: '100%', width: `${Math.min((count / target) * 100, 100)}%`, background: color, borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </div>

      {/* 키워드 검색 */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>포스트 검색</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="검색 키워드"
            style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13 }}
            onKeyDown={e => e.key === 'Enter' && handleSearch()} />
          <button onClick={handleSearch} disabled={searching} className="btn-primary" style={{ padding: '8px 16px' }}>
            {searching ? '검색 중...' : '검색'}
          </button>
        </div>
        {searchResults.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {searchResults.map((post, i) => (
              <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--primary)' }}>@{post.username}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-s)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.text}</div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => handleAddTask('comment', post.url, post.username)} className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}>댓글</button>
                  <button onClick={() => handleAddTask('like', post.url, post.username)} className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}>좋아요</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 대기 태스크 + 실행 */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>대기 태스크 ({pendingTasks.length})</h2>
          <button onClick={handleExecute} disabled={executing || pendingTasks.length === 0} className="btn-primary" style={{ padding: '6px 14px', fontSize: 12 }}>
            {executing ? '실행 중...' : '실행'}
          </button>
        </div>
        {pendingTasks.length === 0 ? (
          <div style={{ color: 'var(--text-s)', fontSize: 13 }}>대기 중인 태스크 없음</div>
        ) : (
          pendingTasks.slice(0, 20).map(task => (
            <div key={task.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text)' }}>{ACTION_LABELS[task.action]} — {task.targetUsername ? `@${task.targetUsername}` : task.targetUrl.slice(0, 40)}</span>
              <span style={{ color: STATUS_LABELS[task.status]?.color }}>{STATUS_LABELS[task.status]?.label}</span>
            </div>
          ))
        )}
      </div>

      {/* 최근 이력 */}
      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>최근 이력</h2>
        {todayTasks.filter(t => t.status !== 'pending').length === 0 ? (
          <div style={{ color: 'var(--text-s)', fontSize: 13 }}>오늘 실행 이력 없음</div>
        ) : (
          todayTasks.filter(t => t.status !== 'pending').slice(0, 20).map(task => (
            <div key={task.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text)' }}>{ACTION_LABELS[task.action]} — {task.targetUsername ? `@${task.targetUsername}` : task.targetUrl.slice(0, 40)}</span>
              <span style={{ color: STATUS_LABELS[task.status]?.color }}>{STATUS_LABELS[task.status]?.label}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
