'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import type { ThreadPost } from '@/lib/types'

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!text) return null

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div className="section-title" style={{ marginBottom: 0 }}>{label}</div>
        <button className="btn btn-ghost btn-sm" onClick={handleCopy} style={copied ? { color: 'var(--mint)', borderColor: 'var(--mint)' } : {}}>
          {copied ? '✓ 복사됨' : '복사'}
        </button>
      </div>
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 8,
        padding: '12px 14px',
        fontSize: 13,
        lineHeight: 1.6,
        color: 'var(--text)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {text}
      </div>
      <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-m)' }}>
        {text.length}자
      </div>
    </div>
  )
}

export default function PublishPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [post, setPost] = useState<ThreadPost | null>(null)
  const [publishedUrl, setPublishedUrl] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/posts/${id}`).then((r) => r.json()).then((p: ThreadPost) => {
      setPost(p)
      if (p.publishedUrl) setPublishedUrl(p.publishedUrl)
    })
  }, [id])

  async function handleMarkPublished() {
    setSaving(true)
    try {
      await fetch(`/api/posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'published',
          publishedAt: new Date().toISOString(),
          publishedUrl: publishedUrl || undefined,
        }),
      })
      router.push('/posts')
    } finally {
      setSaving(false)
    }
  }

  if (!post) return <div style={{ color: 'var(--text-m)' }}>로딩 중...</div>

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ fontSize: 11, color: 'var(--text-m)', marginBottom: 8 }}>
        포스트 &gt; {post.topic} &gt; <span style={{ color: 'var(--primary)' }}>수동 발행</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>Step 5 — 수동 발행 헬퍼</h1>
        <div style={{ padding: '4px 10px', background: 'rgba(0,212,255,0.08)', borderRadius: 20, fontSize: 11, color: 'var(--primary)' }}>5 / 5</div>
      </div>

      {/* Instructions */}
      <div className="card" style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(0,200,150,0.06)', borderColor: 'rgba(0,200,150,0.2)' }}>
        <div style={{ fontSize: 12, color: 'var(--gold-l)', fontWeight: 600, marginBottom: 8 }}>📱 발행 순서</div>
        <ol style={{ fontSize: 11, color: 'var(--text-s)', lineHeight: 1.8, paddingLeft: 16 }}>
          <li>본글을 복사 → Threads 앱에 붙여넣기 → 발행</li>
          {post.thread.reply1 && <li>댓글 1을 복사 → 본글에 댓글로 달기</li>}
          {post.thread.reply2 && <li>댓글 2를 복사 → 댓글 1에 이어 달기</li>}
          {post.thread.reply3 && <li>댓글 3을 복사 → 어필리에이트 링크 포함해 달기</li>}
        </ol>
      </div>

      {/* Copy blocks */}
      <CopyBlock label="본글" text={post.thread.main} />
      {post.thread.reply1 && <CopyBlock label="댓글 1" text={post.thread.reply1} />}
      {post.thread.reply2 && <CopyBlock label="댓글 2" text={post.thread.reply2} />}
      {post.thread.reply3 && <CopyBlock label="댓글 3 (링크 포함)" text={post.thread.reply3} />}

      {/* Published URL */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-title">발행된 Threads 링크 (선택사항)</div>
        <input
          className="input"
          placeholder="https://www.threads.net/..."
          value={publishedUrl}
          onChange={(e) => setPublishedUrl(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={() => router.back()}>이전</button>
        <button className="btn btn-primary" onClick={handleMarkPublished} disabled={saving}>
          {saving ? '처리 중...' : '✓ 발행 완료'}
        </button>
      </div>
    </div>
  )
}
