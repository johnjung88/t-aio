'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { HookAngle, HookType, ThreadPost } from '@/lib/types'

const HOOK_TYPE_LABEL: Record<HookType, string> = {
  empathy_story: '공감형썰',
  price_shock: '충격가격비교',
  comparison: '비교분석',
  social_proof: '사회적증거',
  reverse: '역발상',
}

function renderStars(strength: HookAngle['strength']) {
  return '★'.repeat(strength) + '☆'.repeat(5 - strength)
}


export default function HooksPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [post, setPost] = useState<ThreadPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [directHook, setDirectHook] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    setLoading(true)
    fetch('/api/posts')
      .then((r) => r.json())
      .then((res) => {
        const posts: ThreadPost[] = res.data ?? []
        const found = posts.find((p) => p.id === params.id) ?? null
        setPost(found)
        setDirectHook(found?.selectedHook ?? '')
      })
      .catch(() => setMessage('포스트를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [params.id])

  const selectedHook = useMemo(() => {
    if (!post) return ''
    return post.selectedHook ?? directHook.trim()
  }, [post, directHook])

  const generateHooks = async () => {
    if (!post) return
    setGenerating(true)
    setMessage('')

    try {
      const response = await fetch('/api/generate/hooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id }),
      })
      const res = await response.json()
      if (!response.ok) {
        setMessage(res.error?.message ?? res.error ?? '후킹 생성에 실패했습니다.')
        return
      }

      const hooks: HookAngle[] = res.data?.hooks ?? []
      setPost({ ...post, hookAngles: hooks, status: 'hooks_ready' })
      if (hooks.length === 0) setMessage('생성된 후킹이 없습니다.')
    } catch {
      setMessage('후킹 생성 중 오류가 발생했습니다.')
    } finally {
      setGenerating(false)
    }
  }

  const saveSelectedHook = async (hook: string) => {
    if (!post) return

    const trimmed = hook.trim()
    if (!trimmed) {
      setMessage('후킹 내용을 입력해 주세요.')
      return
    }

    setSaving(true)
    setMessage('')
    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedHook: trimmed, status: 'hooks_ready' }),
      })
      const patchRes = await response.json()
      if (!response.ok) {
        setMessage('후킹 저장에 실패했습니다.')
        return
      }
      const nextPost = patchRes.data ?? patchRes
      setPost(nextPost)
      setDirectHook(nextPost.selectedHook ?? trimmed)
      setMessage('선택한 후킹이 저장되었습니다.')
    } catch {
      setMessage('후킹 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="card">불러오는 중...</div>
  }

  if (!post) {
    return <div className="card">포스트를 찾을 수 없습니다.</div>
  }

  return (
    <div style={{ maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card">
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>후킹 각도 선택</h1>
        <div style={{ color: 'var(--text-s)' }}>{post.topic || '주제 없음'}</div>
      </div>

      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ color: 'var(--text-s)' }}>AI로 후킹 각도를 자동 생성합니다.</div>
        <button className="btn btn-primary" onClick={generateHooks} disabled={generating || saving}>
          {generating ? '생성 중...' : '후킹 생성'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
        {(post.hookAngles ?? []).map((angle) => (
          <div key={`${angle.type}-${angle.angle}`} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
              <span className="tag">{HOOK_TYPE_LABEL[angle.type]}</span>
              <span style={{ color: 'var(--orange)', fontSize: '0.78rem' }}>{renderStars(angle.strength)}</span>
            </div>
            <div style={{ fontSize: '0.9rem', lineHeight: 1.55, marginBottom: '0.8rem', minHeight: '68px' }}>{angle.angle}</div>
            <button className="btn btn-ghost btn-sm" onClick={() => saveSelectedHook(angle.angle)} disabled={saving || generating}>
              선택
            </button>
          </div>
        ))}
      </div>

      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>직접 입력</div>
        <textarea
          className="input"
          value={directHook}
          onChange={(e) => setDirectHook(e.target.value)}
          placeholder="직접 사용할 후킹 문구를 입력하세요"
          rows={4}
        />
        <div style={{ marginTop: '0.7rem', display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={() => saveSelectedHook(directHook)} disabled={saving || generating}>
            {saving ? '저장 중...' : '직접 입력으로 진행'}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => router.push(`/posts/${post.id}/draft`)}
            disabled={!selectedHook || saving || generating}
          >
            다음: 대본 작성 →
          </button>
        </div>
      </div>

      {message && (
        <div className="card" style={{ color: message.includes('실패') || message.includes('오류') ? 'var(--red)' : 'var(--mint)' }}>
          {message}
        </div>
      )}
    </div>
  )
}
