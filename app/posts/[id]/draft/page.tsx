'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ThreadPost } from '@/lib/types'

type ThreadKey = 'main' | 'reply1' | 'reply2' | 'reply3'

const TAB_LABEL: Record<ThreadKey, string> = {
  main: '본글',
  reply1: '댓글1',
  reply2: '댓글2',
  reply3: '댓글3',
}

export default function DraftPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [post, setPost] = useState<ThreadPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState<ThreadKey>('main')
  const [thread, setThread] = useState<ThreadPost['thread']>({ main: '' })

  useEffect(() => {
    setLoading(true)
    fetch('/api/posts')
      .then((r) => r.json())
      .then((res) => {
        const posts: ThreadPost[] = res.data ?? []
        const found = posts.find((p) => p.id === params.id) ?? null
        setPost(found)
        if (found) setThread(found.thread)
      })
      .catch(() => setMessage('포스트를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [params.id])

  // Bug fix: 빈 문자열('')도 undefined 처럼 취급 — AI 생성 전에는 reply가 없어야 함
  const visibleTabs = useMemo(() => {
    if (!post) return ['main'] as ThreadKey[]
    const tabs: ThreadKey[] = ['main']
    if (thread.reply1 !== undefined && thread.reply1 !== '') tabs.push('reply1')
    if (thread.reply2 !== undefined && thread.reply2 !== '') tabs.push('reply2')
    if (thread.reply3 !== undefined && thread.reply3 !== '') tabs.push('reply3')
    return tabs
  }, [thread])

  // activeText는 아래 JSX 직전에 정의되므로 length만 여기서 계산
  const activeTextValue = activeTab === 'main' ? thread.main : (thread[activeTab] ?? '')
  const activeLength = activeTextValue.length

  const updateText = (value: string) => {
    // Bug fix: 모든 탭 500자 제한
    const trimmed = value.slice(0, 500)
    if (activeTab === 'main') {
      setThread((prev) => ({ ...prev, main: trimmed }))
      return
    }
    setThread((prev) => ({ ...prev, [activeTab]: trimmed }))
  }

  const runGenerateDraft = async () => {
    if (!post) return
    setGenerating(true)
    setMessage('')

    try {
      const response = await fetch('/api/generate/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id }),
      })
      const res = await response.json()
      if (!response.ok) {
        setMessage(res.error?.message ?? '대본 생성에 실패했습니다.')
        return
      }

      const nextThread: ThreadPost['thread'] = res.data?.draft ?? { main: '' }
      setThread(nextThread)
      setPost({ ...post, thread: nextThread, status: 'draft' })
    } catch {
      setMessage('대본 생성 중 오류가 발생했습니다.')
    } finally {
      setGenerating(false)
    }
  }

  const saveDraft = async () => {
    if (!post) return
    if (!thread.main.trim()) {
      setMessage('본글을 입력해 주세요.')
      return
    }

    setSaving(true)
    setMessage('')
    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread, status: 'draft' }),
      })
      const saveRes = await response.json()
      if (!response.ok) {
        setMessage('저장에 실패했습니다.')
        return
      }

      const saved = saveRes.data ?? saveRes
      setPost(saved as ThreadPost)
      setThread((saved as ThreadPost).thread)
      setMessage('대본이 저장되었습니다.')
    } catch {
      setMessage('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="card">불러오는 중...</div>
  if (!post) return <div className="card">포스트를 찾을 수 없습니다.</div>

  return (
    <div style={{ maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card">
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.4rem' }}>대본 에디터</h1>
        <div style={{ color: 'var(--text-s)' }}>{post.topic || '주제 없음'}</div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
          {visibleTabs.map((tab) => (
            <button
              key={tab}
              className="btn btn-sm"
              onClick={() => setActiveTab(tab)}
              style={{
                background: activeTab === tab ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
                color: activeTab === tab ? '#000' : 'var(--text)',
                border: activeTab === tab ? 'none' : '1px solid var(--border)',
              }}
            >
              {TAB_LABEL[tab]}
            </button>
          ))}
        </div>

        {activeTab === 'reply3' && (
          <div style={{ marginBottom: '0.6rem', fontSize: '0.82rem', color: 'var(--orange)' }}>
            댓글3에 링크 삽입 예정 (본글에는 링크 없음)
          </div>
        )}

        <textarea
          className="input"
          rows={8}
          value={activeTextValue}
          onChange={(e) => updateText(e.target.value)}
          placeholder="내용을 입력하세요"
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.55rem', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span className={activeLength >= 500 ? 'char-over' : activeLength > 450 ? 'char-warn' : 'char-ok'}>
            {TAB_LABEL[activeTab]} {activeLength}/500
          </span>
          <button className="btn btn-ghost" onClick={runGenerateDraft} disabled={generating || saving}>
            {generating ? '생성 중...' : 'AI 전체 생성'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button className="btn btn-ghost" onClick={saveDraft} disabled={saving || generating}>
          {saving ? '저장 중...' : '저장'}
        </button>
        <button className="btn btn-primary" onClick={() => router.push(`/posts/${post.id}/schedule`)} disabled={!thread.main.trim()}>
          다음: 예약 →
        </button>
      </div>

      {message && (
        <div className="card" style={{ color: message.includes('실패') || message.includes('오류') ? 'var(--red)' : 'var(--mint)' }}>
          {message}
        </div>
      )}
    </div>
  )
}
