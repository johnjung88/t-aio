'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import type { ThreadPost } from '@/lib/types'

const TABS = [
  { key: 'main',   label: '본글', limit: 500 },
  { key: 'reply1', label: '댓글 1', limit: 500 },
  { key: 'reply2', label: '댓글 2', limit: 500 },
  { key: 'reply3', label: '댓글 3', limit: 500 },
] as const

type TabKey = typeof TABS[number]['key']

function charCountClass(len: number, limit: number) {
  if (len > limit) return 'char-over'
  if (len > limit * 0.9) return 'char-warn'
  return 'char-ok'
}

export default function DraftPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [post, setPost] = useState<ThreadPost | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('main')
  const [draft, setDraft] = useState({ main: '', reply1: '', reply2: '', reply3: '' })
  const [replyCount, setReplyCount] = useState(3)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/posts/${id}`).then((r) => r.json()).then((p: ThreadPost) => {
      setPost(p)
      setDraft({
        main: p.thread.main ?? '',
        reply1: p.thread.reply1 ?? '',
        reply2: p.thread.reply2 ?? '',
        reply3: p.thread.reply3 ?? '',
      })
    })
  }, [id])

  async function generateDraft() {
    setGenerating(true)
    try {
      const res = await fetch('/api/generate/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: id, replyCount }),
      })
      const data = await res.json()
      setDraft({
        main: data.draft.main ?? '',
        reply1: data.draft.reply1 ?? '',
        reply2: data.draft.reply2 ?? '',
        reply3: data.draft.reply3 ?? '',
      })
    } catch (err) {
      alert('AI 생성 실패. API 키를 확인하세요.')
      console.error(err)
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave(andNext = false) {
    setSaving(true)
    try {
      await fetch(`/api/posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread: draft, status: 'draft' }),
      })
      if (andNext) router.push(`/posts/${id}/schedule`)
    } finally {
      setSaving(false)
    }
  }

  if (!post) return <div style={{ color: 'var(--text-m)' }}>로딩 중...</div>

  const currentTab = TABS.find((t) => t.key === activeTab)!
  const currentText = draft[activeTab]

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ fontSize: 11, color: 'var(--text-m)', marginBottom: 8 }}>
        포스트 &gt; {post.topic} &gt; <span style={{ color: 'var(--primary)' }}>대본 편집</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>Step 3 — 대본 에디터</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ padding: '4px 10px', background: 'rgba(0,212,255,0.08)', borderRadius: 20, fontSize: 11, color: 'var(--primary)' }}>3 / 5</div>
        </div>
      </div>

      {/* Hook + generate controls */}
      <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--text-m)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>선택된 후킹</div>
            <div style={{ fontSize: 12, color: 'var(--text-s)' }}>{post.selectedHook ?? '없음'}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              className="input"
              style={{ width: 130 }}
              value={replyCount}
              onChange={(e) => setReplyCount(Number(e.target.value))}
            >
              <option value={0}>본글만</option>
              <option value={1}>본글+댓글1</option>
              <option value={2}>본글+댓글1,2</option>
              <option value={3}>본글+댓글1,2,3</option>
            </select>
            <button className="btn btn-primary" onClick={generateDraft} disabled={generating}>
              {generating ? '생성 중...' : 'AI 생성'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {TABS.slice(0, replyCount + 1).map((tab) => (
          <button
            key={tab.key}
            className="btn btn-ghost btn-sm"
            style={activeTab === tab.key ? { borderColor: 'var(--primary)', color: 'var(--primary)' } : {}}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {draft[tab.key] && (
              <span style={{ marginLeft: 4, fontSize: 9, color: 'var(--mint)' }}>●</span>
            )}
          </button>
        ))}
      </div>

      {/* Editor */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-s)' }}>{currentTab.label}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={charCountClass(currentText.length, currentTab.limit)} style={{ fontSize: 11 }}>
              {currentText.length} / {currentTab.limit}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={async () => {
                // Regenerate just this tab
                setGenerating(true)
                try {
                  const res = await fetch('/api/generate/draft', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ postId: id, replyCount }),
                  })
                  const data = await res.json()
                  if (data.draft[activeTab]) {
                    setDraft((prev) => ({ ...prev, [activeTab]: data.draft[activeTab] }))
                  }
                } finally {
                  setGenerating(false)
                }
              }}
              disabled={generating}
            >
              이 탭 재생성
            </button>
          </div>
        </div>
        <textarea
          className="input"
          style={{ minHeight: 200 }}
          value={currentText}
          onChange={(e) => setDraft((prev) => ({ ...prev, [activeTab]: e.target.value }))}
          placeholder={activeTab === 'main' ? '본글을 작성하세요 (AI 생성 또는 직접 입력)' : `${currentTab.label} 내용을 작성하세요`}
        />
      </div>

      {/* Affiliate link notice */}
      {post.contentType === 'affiliate' && activeTab === 'reply3' && (
        <div style={{ padding: '8px 12px', background: 'rgba(0,212,255,0.06)', borderRadius: 8, fontSize: 11, color: 'var(--primary)', marginBottom: 16 }}>
          💡 댓글 3에 어필리에이트 링크를 자연스럽게 포함하세요
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={() => router.back()}>이전</button>
        <button className="btn btn-ghost" onClick={() => handleSave(false)} disabled={saving}>저장</button>
        <button className="btn btn-primary" onClick={() => handleSave(true)} disabled={saving}>
          {saving ? '저장 중...' : '예약 설정 →'}
        </button>
      </div>
    </div>
  )
}
