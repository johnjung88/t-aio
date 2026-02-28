'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import type { ThreadPost, HookAngle } from '@/lib/types'

const STRENGTH_STARS = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n)

const HOOK_TYPE_LABELS: Record<HookAngle['type'], string> = {
  pain: '고통포인트',
  curiosity: '궁금증 유발',
  number: '숫자 후킹',
  empathy: '공감',
  comparison: '비교',
}

export default function HooksPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [post, setPost] = useState<ThreadPost | null>(null)
  const [generating, setGenerating] = useState(false)
  const [selected, setSelected] = useState<string>('')
  const [customHook, setCustomHook] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/posts/${id}`).then((r) => r.json()).then((p: ThreadPost) => {
      setPost(p)
      if (p.selectedHook) setSelected(p.selectedHook)
    })
  }, [id])

  async function generateHooks() {
    setGenerating(true)
    try {
      const res = await fetch('/api/generate/hooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: id }),
      })
      const data = await res.json()
      setPost((prev) => prev ? { ...prev, hookAngles: data.hooks, status: 'hooks_ready' } : prev)
    } catch (err) {
      alert('AI 생성 실패. API 키를 확인하세요.')
      console.error(err)
    } finally {
      setGenerating(false)
    }
  }

  async function handleNext() {
    const hook = customHook.trim() || selected
    if (!hook) return alert('후킹 각도를 선택하거나 입력하세요')
    setSaving(true)
    try {
      await fetch(`/api/posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedHook: hook }),
      })
      router.push(`/posts/${id}/draft`)
    } finally {
      setSaving(false)
    }
  }

  if (!post) return <div style={{ color: 'var(--text-m)' }}>로딩 중...</div>

  return (
    <div style={{ maxWidth: 700 }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 11, color: 'var(--text-m)', marginBottom: 8 }}>
        포스트 &gt; {post.topic} &gt; <span style={{ color: 'var(--primary)' }}>후킹 선택</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>Step 2 — 후킹 각도 선택</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ padding: '4px 10px', background: 'rgba(0,212,255,0.08)', borderRadius: 20, fontSize: 11, color: 'var(--primary)' }}>
            2 / 5
          </div>
        </div>
      </div>

      {/* Topic info */}
      <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
        <div style={{ fontSize: 11, color: 'var(--text-m)' }}>주제</div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{post.topic}</div>
      </div>

      {/* Generate button */}
      {(!post.hookAngles || post.hookAngles.length === 0) && (
        <div className="card" style={{ textAlign: 'center', padding: 32, marginBottom: 16 }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>🪝</div>
          <div style={{ fontSize: 13, color: 'var(--text-s)', marginBottom: 16 }}>
            AI가 제품/주제를 분석해 5가지 후킹 각도를 생성합니다
          </div>
          <button className="btn btn-primary" onClick={generateHooks} disabled={generating}>
            {generating ? '생성 중...' : 'AI 후킹 생성'}
          </button>
        </div>
      )}

      {post.hookAngles && post.hookAngles.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>후킹 각도 선택</div>
            <button className="btn btn-ghost btn-sm" onClick={generateHooks} disabled={generating}>
              {generating ? '재생성 중...' : '재생성'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {post.hookAngles.map((h, i) => (
              <div
                key={i}
                className="card"
                style={{
                  cursor: 'pointer',
                  borderColor: selected === h.angle ? 'var(--primary)' : 'var(--border)',
                  background: selected === h.angle ? 'rgba(0,212,255,0.06)' : 'var(--bg-card)',
                  padding: '14px 16px',
                }}
                onClick={() => { setSelected(h.angle); setCustomHook('') }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span className="tag">{HOOK_TYPE_LABELS[h.type]}</span>
                  <span style={{ fontSize: 11, color: 'var(--gold-l)' }}>{STRENGTH_STARS(h.strength)}</span>
                  {selected === h.angle && <span style={{ fontSize: 11, color: 'var(--primary)' }}>✓ 선택됨</span>}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>{h.angle}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Custom hook input */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-title">직접 입력 (선택사항)</div>
        <textarea
          className="input"
          placeholder="원하는 후킹 각도를 직접 입력하세요..."
          value={customHook}
          onChange={(e) => { setCustomHook(e.target.value); if (e.target.value) setSelected('') }}
          rows={2}
        />
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={() => router.back()}>이전</button>
        <button className="btn btn-primary" onClick={handleNext} disabled={saving || (!selected && !customHook.trim())}>
          {saving ? '저장 중...' : '대본 생성 →'}
        </button>
      </div>
    </div>
  )
}
