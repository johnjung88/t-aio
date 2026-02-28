'use client'

import { useEffect, useState } from 'react'
import type { StrategyConfig } from '@/lib/types'

type StrategyForm = {
  systemPromptBase: string
  optimalPostLength: string
  hashtagStrategy: string
  replyCount: '0' | '1' | '2' | '3'
  bestPostTimes: string
  commentDelayMin: string
  commentDelayMax: string
  hookFormulas: string
}

const EMPTY_FORM: StrategyForm = {
  systemPromptBase: '',
  optimalPostLength: '150',
  hashtagStrategy: '',
  replyCount: '3',
  bestPostTimes: '07:30, 20:00',
  commentDelayMin: '20',
  commentDelayMax: '90',
  hookFormulas: '',
}

function toForm(config: StrategyConfig): StrategyForm {
  return {
    systemPromptBase: config.systemPromptBase,
    optimalPostLength: String(config.optimalPostLength),
    hashtagStrategy: config.hashtagStrategy,
    replyCount: String(config.replyCount) as StrategyForm['replyCount'],
    bestPostTimes: config.bestPostTimes.join(', '),
    commentDelayMin: String(config.commentDelayMin),
    commentDelayMax: String(config.commentDelayMax),
    hookFormulas: config.hookFormulas.join('\n'),
  }
}

function validateAndBuildPayload(form: StrategyForm): { ok: true; data: StrategyConfig } | { ok: false; error: string } {
  const optimalPostLength = Number(form.optimalPostLength)
  const commentDelayMin = Number(form.commentDelayMin)
  const commentDelayMax = Number(form.commentDelayMax)
  const replyCount = Number(form.replyCount) as 0 | 1 | 2 | 3

  if (!Number.isInteger(optimalPostLength) || optimalPostLength <= 0) {
    return { ok: false, error: '최적 글자수는 1 이상의 정수여야 합니다.' }
  }
  if (!Number.isInteger(commentDelayMin) || commentDelayMin < 0) {
    return { ok: false, error: '최소 댓글 지연은 0 이상의 정수여야 합니다.' }
  }
  if (!Number.isInteger(commentDelayMax) || commentDelayMax < 0) {
    return { ok: false, error: '최대 댓글 지연은 0 이상의 정수여야 합니다.' }
  }
  if (commentDelayMin > commentDelayMax) {
    return { ok: false, error: '최소 댓글 지연은 최대 댓글 지연보다 클 수 없습니다.' }
  }

  const bestPostTimes = form.bestPostTimes
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  const invalidTime = bestPostTimes.find((item) => !/^([01]\d|2[0-3]):([0-5]\d)$/.test(item))
  if (invalidTime) {
    return { ok: false, error: `잘못된 시간 형식이 있습니다: ${invalidTime}` }
  }

  const hookFormulas = form.hookFormulas
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)

  return {
    ok: true,
    data: {
      systemPromptBase: form.systemPromptBase,
      optimalPostLength,
      hashtagStrategy: form.hashtagStrategy,
      replyCount,
      bestPostTimes,
      commentDelayMin,
      commentDelayMax,
      hookFormulas,
    },
  }
}

export default function StrategyPage() {
  const [form, setForm] = useState<StrategyForm>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setLoading(true)
    fetch('/api/strategy')
      .then((r) => r.json())
      .then((res) => {
        const config: StrategyConfig = res.data ?? res
        setForm(toForm(config))
      })
      .catch(() => setMessage('전략 설정을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [])

  const update = (key: keyof StrategyForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const save = async () => {
    const parsed = validateAndBuildPayload(form)
    if (!parsed.ok) {
      setMessage(parsed.error)
      return
    }

    setSaving(true)
    setMessage('')
    try {
      const response = await fetch('/api/strategy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })

      if (!response.ok) {
        setMessage('저장에 실패했습니다.')
        return
      }

      const res = await response.json()
      const saved: StrategyConfig = res.data ?? res
      setForm(toForm(saved))
      setMessage('설정이 저장되었습니다')
    } catch {
      setMessage('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="card">불러오는 중...</div>
  }

  return (
    <div style={{ maxWidth: '920px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card">
        <h1 style={{ fontSize: '1.45rem', fontWeight: 700, marginBottom: '0.45rem' }}>전략 설정</h1>
        <div style={{ color: 'var(--text-s)' }}>콘텐츠 생성 규칙과 운영 파라미터를 편집합니다.</div>
      </div>

      <div className="card" style={{ display: 'grid', gap: '0.8rem' }}>
        <label style={{ color: 'var(--text-s)' }}>시스템 프롬프트</label>
        <textarea className="input" rows={5} value={form.systemPromptBase} onChange={(e) => update('systemPromptBase', e.target.value)} />

        <label style={{ color: 'var(--text-s)' }}>최적 글자수</label>
        <input className="input" type="number" value={form.optimalPostLength} onChange={(e) => update('optimalPostLength', e.target.value)} />

        <label style={{ color: 'var(--text-s)' }}>해시태그 전략</label>
        <input className="input" value={form.hashtagStrategy} onChange={(e) => update('hashtagStrategy', e.target.value)} />

        <label style={{ color: 'var(--text-s)' }}>댓글 수</label>
        <select className="input" value={form.replyCount} onChange={(e) => update('replyCount', e.target.value)}>
          <option value="0">0</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
        </select>

        <label style={{ color: 'var(--text-s)' }}>최적 발행 시간 (쉼표 구분)</label>
        <input className="input" value={form.bestPostTimes} onChange={(e) => update('bestPostTimes', e.target.value)} placeholder="07:30, 20:00" />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.8rem' }}>
          <div style={{ display: 'grid', gap: '0.4rem' }}>
            <label style={{ color: 'var(--text-s)' }}>댓글 지연 최소(초)</label>
            <input className="input" type="number" value={form.commentDelayMin} onChange={(e) => update('commentDelayMin', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gap: '0.4rem' }}>
            <label style={{ color: 'var(--text-s)' }}>댓글 지연 최대(초)</label>
            <input className="input" type="number" value={form.commentDelayMax} onChange={(e) => update('commentDelayMax', e.target.value)} />
          </div>
        </div>

        <label style={{ color: 'var(--text-s)' }}>후킹 공식 (줄바꿈 구분)</label>
        <textarea className="input" rows={6} value={form.hookFormulas} onChange={(e) => update('hookFormulas', e.target.value)} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      {message && (
        <div className="card" style={{ color: message.includes('실패') || message.includes('오류') || message.includes('잘못') ? 'var(--red)' : 'var(--mint)' }}>
          {message}
        </div>
      )}
    </div>
  )
}
