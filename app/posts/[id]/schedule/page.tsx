'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { StrategyConfig, ThreadPost } from '@/lib/types'

function toDatetimeLocalValue(iso?: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60000)
  return localDate.toISOString().slice(0, 16)
}

function parseRecommendedDate(timeText: string): string {
  const [hText, mText] = timeText.split(':')
  const hour = Number(hText)
  const minute = Number(mText)

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return ''
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return ''

  const date = new Date()
  date.setHours(hour, minute, 0, 0)
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16)
}

function isThreadPost(value: unknown): value is ThreadPost {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'id' in value &&
      'thread' in value
  )
}

export default function SchedulePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [post, setPost] = useState<ThreadPost | null>(null)
  const [strategy, setStrategy] = useState<StrategyConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([fetch(`/api/posts/${params.id}`).then((r) => r.json()), fetch('/api/strategy').then((r) => r.json())])
      .then(([postRes, stratRes]) => {
        const found: ThreadPost | null = postRes.data ?? null
        const strategyData: StrategyConfig = stratRes.data ?? stratRes
        setPost(found)
        setStrategy(strategyData)
        setScheduledAt(toDatetimeLocalValue(found?.scheduledAt))
      })
      .catch(() => setMessage('데이터를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [params.id])

  const bestTimesText = useMemo(() => {
    if (!strategy || strategy.bestPostTimes.length === 0) return '추천 시간이 없습니다.'
    return strategy.bestPostTimes.join(', ')
  }, [strategy])

  const applyRecommendedTime = () => {
    const best = strategy?.bestPostTimes?.[0]
    if (!best) {
      setMessage('추천 시간이 설정되어 있지 않습니다.')
      return
    }

    const recommended = parseRecommendedDate(best)
    if (!recommended) {
      setMessage('추천 시간 형식이 올바르지 않습니다.')
      return
    }

    setScheduledAt(recommended)
    setMessage('추천 시간이 적용되었습니다.')
  }

  const saveSchedule = async () => {
    if (!post) return
    if (!scheduledAt) {
      setMessage('발행 시간을 선택해 주세요.')
      return
    }

    const iso = new Date(scheduledAt).toISOString()
    setSaving(true)
    setMessage('')

    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt: iso, status: 'scheduled' }),
      })
      const payload = (await response.json()) as unknown
      if (!response.ok) {
        setMessage('예약 저장에 실패했습니다.')
        return
      }
      const nextPost = (payload as { data?: unknown }).data ?? payload
      if (!isThreadPost(nextPost)) {
        setMessage('예약 저장에 실패했습니다.')
        return
      }

      setPost(nextPost)
      setScheduledAt(toDatetimeLocalValue(nextPost.scheduledAt))
      setMessage('예약이 확정되었습니다.')
    } catch {
      setMessage('예약 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="card">불러오는 중...</div>
  if (!post) return <div className="card">포스트를 찾을 수 없습니다.</div>

  return (
    <div style={{ maxWidth: '760px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card">
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.4rem' }}>예약 설정</h1>
        <div style={{ color: 'var(--text-s)' }}>{post.topic || '주제 없음'}</div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        <label style={{ fontSize: '0.86rem', color: 'var(--text-s)' }}>발행 시간</label>
        <input
          className="input"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ color: 'var(--text-s)', fontSize: '0.82rem' }}>전략 추천 시간: {bestTimesText}</div>
          <button className="btn btn-ghost" onClick={applyRecommendedTime}>
            최적 발행 시간 추천
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button className="btn btn-ghost" onClick={saveSchedule} disabled={saving}>
          {saving ? '저장 중...' : '예약 확정'}
        </button>
        <button className="btn btn-primary" onClick={() => router.push(`/posts/${post.id}/publish`)} disabled={!scheduledAt}>
          다음: 발행 헬퍼 →
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
