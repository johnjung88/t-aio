'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { ThreadPost } from '@/lib/types'

const STATUS_LABEL: Record<string, string> = {
  new: '신규',
  hooks_ready: '후킹완료',
  draft: '초안완료',
  scheduled: '예약됨',
  published: '발행완료',
}

const STATUS_COLOR: Record<string, string> = {
  new: 'var(--muted)',
  hooks_ready: 'var(--purple)',
  draft: 'var(--mint)',
  scheduled: 'var(--orange)',
  published: 'var(--green)',
}

export default function PostsPage() {
  const [posts, setPosts] = useState<ThreadPost[]>([])
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    fetch('/api/posts').then((r) => r.json()).then((res) => setPosts(res.data ?? []))
  }, [])

  const filtered = filter === 'all' ? posts : posts.filter((p) => p.status === filter)

  const handleDelete = async (id: string) => {
    if (!confirm('이 포스트를 삭제하시겠습니까?')) return
    await fetch(`/api/posts/${id}`, { method: 'DELETE' })
    setPosts((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>포스트 목록</h1>
        <Link href="/posts/new">
          <button className="btn-primary">+ 새 포스트</button>
        </Link>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {['all', 'new', 'hooks_ready', 'draft', 'scheduled', 'published'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              padding: '0.35rem 0.85rem',
              borderRadius: '999px',
              border: '1px solid',
              borderColor: filter === s ? 'var(--primary)' : 'var(--border)',
              background: filter === s ? 'var(--primary)' : 'transparent',
              color: filter === s ? '#000' : 'var(--text-secondary)',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            {s === 'all' ? '전체' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem' }}>
          포스트가 없습니다.{' '}
          <Link href="/posts/new" style={{ color: 'var(--primary)' }}>새 포스트 만들기 →</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filtered.map((post) => (
            <div key={post.id} className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '999px',
                      background: STATUS_COLOR[post.status] + '22',
                      color: STATUS_COLOR[post.status],
                      fontWeight: 600,
                    }}
                  >
                    {STATUS_LABEL[post.status]}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{post.account}</span>
                  {post.scheduledAt && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--orange)' }}>
                      {new Date(post.scheduledAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <div style={{ fontWeight: 500 }}>{post.topic}</div>
                {post.thread?.main && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '500px' }}>
                    {post.thread.main}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                {post.status === 'new' && (
                  <Link href={`/posts/${post.id}/hooks`}><button className="btn-secondary" style={{ fontSize: '0.8rem' }}>후킹 →</button></Link>
                )}
                {post.status === 'hooks_ready' && (
                  <Link href={`/posts/${post.id}/draft`}><button className="btn-secondary" style={{ fontSize: '0.8rem' }}>대본 →</button></Link>
                )}
                {post.status === 'draft' && (
                  <Link href={`/posts/${post.id}/schedule`}><button className="btn-secondary" style={{ fontSize: '0.8rem' }}>예약 →</button></Link>
                )}
                {post.status === 'scheduled' && (
                  <Link href={`/posts/${post.id}/publish`}><button className="btn-primary" style={{ fontSize: '0.8rem' }}>발행 →</button></Link>
                )}
                {post.status === 'published' && (
                  <Link href={`/posts/${post.id}/publish`}><button className="btn-secondary" style={{ fontSize: '0.8rem' }}>완료 →</button></Link>
                )}
                <button
                  onClick={() => handleDelete(post.id)}
                  style={{ padding: '0.35rem 0.7rem', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
