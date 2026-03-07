'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { ThreadPost } from '@/lib/types'

const COPY_TARGETS = ['main', 'reply1', 'reply2', 'reply3'] as const

type CopyKey = (typeof COPY_TARGETS)[number]

function isThreadPost(value: unknown): value is ThreadPost {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'id' in value &&
      'thread' in value
  )
}

export default function PublishPage({ params }: { params: { id: string } }) {
  const [post, setPost] = useState<ThreadPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [finishing, setFinishing] = useState(false)
  const [publishedUrl, setPublishedUrl] = useState('')
  const [copied, setCopied] = useState<CopyKey | ''>('')
  const [message, setMessage] = useState('')
  const [completed, setCompleted] = useState(false)
  const [autoPublishing, setAutoPublishing] = useState(false)
  const [publishStep, setPublishStep] = useState('')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/posts/${params.id}`)
      .then((r) => r.json())
      .then((res) => {
        const found: ThreadPost | null = res.data ?? null
        setPost(found)
        setPublishedUrl(found?.publishedUrl ?? '')
      })
      .catch(() => setMessage('포스트를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [params.id])

  const copyText = async (key: CopyKey) => {
    if (!post) return
    const text = post.thread[key] ?? ''
    if (!text.trim()) {
      setMessage('복사할 텍스트가 비어 있습니다.')
      return
    }

    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setMessage('복사되었습니다.')
      setTimeout(() => setCopied((prev) => (prev === key ? '' : prev)), 1500)
    } catch {
      setMessage('복사에 실패했습니다.')
    }
  }

  const completePublish = async () => {
    if (!post) return

    setFinishing(true)
    setMessage('')

    try {
      const payload: { publishedAt: string; status: ThreadPost['status']; publishedUrl?: string } = {
        publishedAt: new Date().toISOString(),
        status: 'published',
      }
      const trimmed = publishedUrl.trim()
      if (trimmed) payload.publishedUrl = trimmed

      const response = await fetch(`/api/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const res = (await response.json()) as unknown
      if (!response.ok) {
        setMessage('발행 완료 처리에 실패했습니다.')
        return
      }
      const nextPost = (res as { data?: unknown }).data ?? res
      if (!isThreadPost(nextPost)) {
        setMessage('발행 완료 처리에 실패했습니다.')
        return
      }

      setPost(nextPost)
      setCompleted(true)
      setMessage('발행 완료로 처리되었습니다.')
    } catch {
      setMessage('발행 완료 처리 중 오류가 발생했습니다.')
    } finally {
      setFinishing(false)
    }
  }

  const autoPublish = async () => {
    if (!post) return
    setAutoPublishing(true)
    setMessage('')
    setPublishStep('본글 발행 중...')

    try {
      const res = await fetch(`/api/posts/${post.id}/publish`, { method: 'POST' })
      const data = await res.json()

      if (!res.ok || !data.success) {
        setMessage(data?.error?.message ?? '자동 발행에 실패했습니다.')
        setPublishStep('')
        return
      }

      const { post: updatedPost, publishedUrl: url, repliesPublished, repliesTotal } = data.data
      setPost(updatedPost)
      setPublishedUrl(url ?? '')
      setCompleted(true)
      setMessage(
        repliesTotal > 0
          ? `자동 발행 완료! 댓글 ${repliesPublished}/${repliesTotal}개 발행됨.`
          : '자동 발행 완료!'
      )
    } catch {
      setMessage('자동 발행 중 오류가 발생했습니다. Pinchtab 서버가 실행 중인지 확인하세요.')
    } finally {
      setAutoPublishing(false)
      setPublishStep('')
    }
  }

  if (loading) return <div className="card">불러오는 중...</div>
  if (!post) return <div className="card">포스트를 찾을 수 없습니다.</div>

  return (
    <div style={{ maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card">
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.45rem' }}>수동 발행 헬퍼</h1>
        <div style={{ color: 'var(--text-s)' }}>{post.topic || '주제 없음'}</div>
      </div>

      {COPY_TARGETS.map((key) => {
        const label = key === 'main' ? '본글' : key.replace('reply', '댓글')
        const text = post.thread[key] ?? ''

        return (
          <div key={key} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ fontWeight: 600 }}>{label}</div>
              <button className="btn btn-ghost btn-sm" onClick={() => copyText(key)}>
                {copied === key ? '복사됨 ✓' : `${label} 복사`}
              </button>
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', color: 'var(--text)', lineHeight: 1.5 }}>
              {text || '(내용 없음)'}
            </pre>
          </div>
        )
      })}

      <div className="card" style={{ color: 'var(--orange)' }}>
        각 댓글은 20~90초 간격으로 순차 발행하세요 (봇 탐지 방지)
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
        <label style={{ fontSize: '0.85rem', color: 'var(--text-s)' }}>발행 링크 (선택)</label>
        <input
          className="input"
          value={publishedUrl}
          onChange={(e) => setPublishedUrl(e.target.value)}
          placeholder="https://threads.net/..."
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {(post.status === 'draft' || post.status === 'scheduled') && (
            <button
              className="btn"
              onClick={autoPublish}
              disabled={autoPublishing || finishing}
              style={{ background: 'var(--mint)', color: '#0F1729', fontWeight: 700 }}
            >
              {autoPublishing ? (publishStep || '자동 발행 중...') : '자동 발행'}
            </button>
          )}
          <button className="btn btn-primary" onClick={completePublish} disabled={finishing || autoPublishing}>
            {finishing ? '처리 중...' : '발행 완료'}
          </button>
        </div>
        <Link href="/posts" className="btn btn-ghost">포스트 목록으로 →</Link>
      </div>

      {completed && (
        <div className="card" style={{ color: 'var(--mint)', borderColor: 'rgba(52,211,153,0.4)' }}>
          발행이 완료되었습니다.
        </div>
      )}

      {message && !completed && (
        <div className="card" style={{ color: message.includes('실패') || message.includes('오류') ? 'var(--red)' : 'var(--mint)' }}>
          {message}
        </div>
      )}
    </div>
  )
}
