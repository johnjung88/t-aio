'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { ThreadPost, PostStatus } from '@/lib/types'

const STATUS_LABELS: Record<PostStatus, string> = {
  new: '신규',
  hooks_ready: '후킹완료',
  draft: '초안완료',
  scheduled: '예약됨',
  published: '발행완료',
}
const STATUS_CLS: Record<PostStatus, string> = {
  new: 'tag-new',
  hooks_ready: 'tag-hooks',
  draft: 'tag-draft',
  scheduled: 'tag-scheduled',
  published: 'tag-published',
}

function nextStep(post: ThreadPost): string {
  switch (post.status) {
    case 'new': return `/posts/${post.id}/hooks`
    case 'hooks_ready': return `/posts/${post.id}/hooks`
    case 'draft': return `/posts/${post.id}/draft`
    case 'scheduled': return `/posts/${post.id}/publish`
    case 'published': return `/posts/${post.id}/publish`
  }
}

export default function PostsPage() {
  const [posts, setPosts] = useState<ThreadPost[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    fetch('/api/posts').then((r) => r.json()).then(setPosts)
  }, [])

  const filtered = statusFilter === 'all' ? posts : posts.filter((p) => p.status === statusFilter)

  async function deletePost(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    await fetch(`/api/posts/${id}`, { method: 'DELETE' })
    setPosts((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>포스트</h1>
          <div style={{ fontSize: 11, color: 'var(--text-m)', marginTop: 4 }}>{posts.length}개 포스트</div>
        </div>
        <Link href="/posts/new" className="btn btn-primary">+ 새 포스트</Link>
      </div>

      {/* Status filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['all', 'new', 'hooks_ready', 'draft', 'scheduled', 'published'].map((s) => (
          <button
            key={s}
            className="btn btn-ghost btn-sm"
            style={statusFilter === s ? { borderColor: 'var(--primary)', color: 'var(--primary)' } : {}}
            onClick={() => setStatusFilter(s)}
          >
            {s === 'all' ? '전체' : STATUS_LABELS[s as PostStatus]}
            {' '}({s === 'all' ? posts.length : posts.filter((p) => p.status === s).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-m)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>✏️</div>
          <div>포스트가 없습니다</div>
          <Link href="/posts/new" className="btn btn-primary" style={{ marginTop: 16 }}>+ 첫 포스트 작성</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((p) => (
            <div key={p.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span className={`tag ${STATUS_CLS[p.status]}`}>{STATUS_LABELS[p.status]}</span>
                  <span className="tag" style={{ background: 'rgba(96,165,250,0.1)', color: 'var(--blue)' }}>
                    {p.contentType === 'affiliate' ? '어필리에이트' : p.contentType === 'informational' ? '정보성' : '개인'}
                  </span>
                  {p.notes?.includes('[자동생성]') && (
                    <span className="tag" style={{ background: 'rgba(52,211,153,0.1)', color: 'var(--mint)' }}>자동</span>
                  )}
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>{p.topic}</div>
                {p.thread.main && (
                  <div style={{ fontSize: 11, color: 'var(--text-m)' }}>
                    {p.thread.main.slice(0, 80)}{p.thread.main.length > 80 ? '…' : ''}
                  </div>
                )}
                <div style={{ fontSize: 10, color: 'var(--text-m)', marginTop: 4 }}>
                  {new Date(p.createdAt).toLocaleDateString('ko-KR')} · {p.account}
                  {p.scheduledAt && ` · 예약: ${new Date(p.scheduledAt).toLocaleString('ko-KR')}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Link href={nextStep(p)} className="btn btn-ghost btn-sm">
                  {p.status === 'published' ? '보기' : '계속 →'}
                </Link>
                <button className="btn btn-danger btn-sm" onClick={() => deletePost(p.id)}>삭제</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
