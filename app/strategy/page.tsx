'use client'

import { useEffect, useState } from 'react'
import type { Account, StrategyConfig, ContentFormat } from '@/lib/types'

const CONTENT_FORMATS: { key: ContentFormat; label: string }[] = [
  { key: 'hook_opinion', label: '후킹 의견' },
  { key: 'question', label: '질문형' },
  { key: 'poll', label: '투표형' },
  { key: 'tip_value', label: '팁/가치' },
  { key: 'story', label: '스토리' },
  { key: 'image_text', label: '이미지+텍스트' },
  { key: 'cta', label: 'CTA' },
]

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']

type StrategyForm = {
  systemPromptBase: string
  optimalPostLength: string
  hashtagStrategy: string
  replyCount: '0' | '1' | '2' | '3'
  bestPostTimes: string
  commentDelayMin: string
  commentDelayMax: string
  hookFormulas: string
  // v2: 6-layer
  persona: string
  targetAudience: string
  brandVoice: string
  contentRules: string
  platformRules: string
  examplePosts: string
  // v2: smart scheduling
  weekdayPostCounts: string[] // 7 strings for Mon-Sun
  // v2: engagement
  engagementEnabled: boolean
  dailyCommentTarget: string
  dailyLikeTarget: string
  dailyFollowTarget: string
  engagementKeywords: string
  // v2: content format weights
  contentFormatWeights: Record<ContentFormat, string>
}

const DEFAULT_FORMAT_WEIGHTS: Record<ContentFormat, string> = {
  hook_opinion: '30', question: '15', poll: '10', tip_value: '20', story: '10', image_text: '5', cta: '10',
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
  persona: '',
  targetAudience: '',
  brandVoice: '',
  contentRules: '',
  platformRules: '',
  examplePosts: '',
  weekdayPostCounts: ['2', '2', '2', '2', '2', '1', '1'],
  engagementEnabled: false,
  dailyCommentTarget: '10',
  dailyLikeTarget: '20',
  dailyFollowTarget: '5',
  engagementKeywords: '',
  contentFormatWeights: { ...DEFAULT_FORMAT_WEIGHTS },
}

function toForm(config: StrategyConfig): StrategyForm {
  const fmtWeights: Record<ContentFormat, string> = { ...DEFAULT_FORMAT_WEIGHTS }
  if (config.contentFormatWeights) {
    for (const [k, v] of Object.entries(config.contentFormatWeights)) {
      fmtWeights[k as ContentFormat] = String(v)
    }
  }
  return {
    systemPromptBase: config.systemPromptBase ?? '',
    optimalPostLength: String(config.optimalPostLength ?? 150),
    hashtagStrategy: config.hashtagStrategy ?? '',
    replyCount: String(config.replyCount ?? 3) as StrategyForm['replyCount'],
    bestPostTimes: (config.bestPostTimes ?? []).join(', '),
    commentDelayMin: String(config.commentDelayMin ?? 20),
    commentDelayMax: String(config.commentDelayMax ?? 90),
    hookFormulas: (config.hookFormulas ?? []).join('\n'),
    persona: config.persona ?? '',
    targetAudience: config.targetAudience ?? '',
    brandVoice: config.brandVoice ?? '',
    contentRules: (config.contentRules ?? []).join('\n'),
    platformRules: (config.platformRules ?? []).join('\n'),
    examplePosts: (config.examplePosts ?? []).join('\n---\n'),
    weekdayPostCounts: config.weekdayPostCounts
      ? config.weekdayPostCounts.map(String)
      : ['2', '2', '2', '2', '2', '1', '1'],
    engagementEnabled: config.engagementEnabled ?? false,
    dailyCommentTarget: String(config.dailyCommentTarget ?? 10),
    dailyLikeTarget: String(config.dailyLikeTarget ?? 20),
    dailyFollowTarget: String(config.dailyFollowTarget ?? 5),
    engagementKeywords: (config.engagementKeywords ?? []).join(', '),
    contentFormatWeights: fmtWeights,
  }
}

function buildPayload(form: StrategyForm): { ok: true; data: Partial<StrategyConfig> } | { ok: false; error: string } {
  const optimalPostLength = Number(form.optimalPostLength)
  const commentDelayMin = Number(form.commentDelayMin)
  const commentDelayMax = Number(form.commentDelayMax)
  const replyCount = Number(form.replyCount) as 0 | 1 | 2 | 3

  if (!Number.isInteger(optimalPostLength) || optimalPostLength <= 0) {
    return { ok: false, error: '최적 글자수는 1 이상의 정수여야 합니다.' }
  }
  if (commentDelayMin < 1 || commentDelayMax < 1) {
    return { ok: false, error: '댓글 지연은 1초 이상이어야 합니다.' }
  }
  if (commentDelayMin > commentDelayMax) {
    return { ok: false, error: '최소 댓글 지연은 최대보다 클 수 없습니다.' }
  }

  const bestPostTimes = form.bestPostTimes.split(',').map(s => s.trim()).filter(Boolean)
  const invalidTime = bestPostTimes.find(t => !/^([01]\d|2[0-3]):([0-5]\d)$/.test(t))
  if (invalidTime) return { ok: false, error: `잘못된 시간 형식: ${invalidTime}` }

  const hookFormulas = form.hookFormulas.split('\n').map(s => s.trim()).filter(Boolean)
  const contentRules = form.contentRules.split('\n').map(s => s.trim()).filter(Boolean)
  const platformRules = form.platformRules.split('\n').map(s => s.trim()).filter(Boolean)
  const examplePosts = form.examplePosts.split('\n---\n').map(s => s.trim()).filter(Boolean)
  const engagementKeywords = form.engagementKeywords.split(',').map(s => s.trim()).filter(Boolean)

  const weekdayPostCounts = form.weekdayPostCounts.map(Number)
  if (weekdayPostCounts.some(n => isNaN(n) || n < 0)) {
    return { ok: false, error: '요일별 포스트 수는 0 이상의 숫자여야 합니다.' }
  }

  const contentFormatWeights: Record<string, number> = {}
  for (const [k, v] of Object.entries(form.contentFormatWeights)) {
    const n = Number(v)
    if (isNaN(n) || n < 0) return { ok: false, error: `포맷 비율이 잘못되었습니다: ${k}` }
    contentFormatWeights[k] = n
  }

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
      persona: form.persona,
      targetAudience: form.targetAudience,
      brandVoice: form.brandVoice,
      contentRules,
      platformRules,
      examplePosts,
      weekdayPostCounts,
      engagementEnabled: form.engagementEnabled,
      dailyCommentTarget: Number(form.dailyCommentTarget),
      dailyLikeTarget: Number(form.dailyLikeTarget),
      dailyFollowTarget: Number(form.dailyFollowTarget),
      engagementKeywords,
      contentFormatWeights: contentFormatWeights as Record<ContentFormat, number>,
    },
  }
}

const sectionStyle = { marginBottom: 8, fontSize: 14, fontWeight: 600 as const, color: 'var(--primary)' }
const labelStyle = { color: 'var(--text-s)', fontSize: 12, marginBottom: 2 }
const inputStyle = { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13, width: '100%' }
const textareaStyle = { ...inputStyle, resize: 'vertical' as const, fontFamily: 'inherit' }

export default function StrategyPage() {
  const [form, setForm] = useState<StrategyForm>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>('default')

  // 계정 목록 로드
  useEffect(() => {
    fetch('/api/accounts')
      .then(r => r.json())
      .then(res => setAccounts(res.data ?? []))
      .catch(() => {})
  }, [])

  // 선택된 계정의 전략 로드
  useEffect(() => {
    setLoading(true)
    const url = selectedAccount === 'default'
      ? '/api/strategy'
      : `/api/strategy?accountId=${selectedAccount}`
    fetch(url)
      .then(r => r.json())
      .then(res => {
        const config: StrategyConfig = res.data ?? res
        setForm(toForm(config))
      })
      .catch(() => setMessage('전략 설정을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [selectedAccount])

  const update = (key: keyof StrategyForm, value: string | boolean) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const updateWeekday = (idx: number, value: string) => {
    setForm(prev => {
      const arr = [...prev.weekdayPostCounts]
      arr[idx] = value
      return { ...prev, weekdayPostCounts: arr }
    })
  }

  const updateFormatWeight = (key: ContentFormat, value: string) => {
    setForm(prev => ({
      ...prev,
      contentFormatWeights: { ...prev.contentFormatWeights, [key]: value },
    }))
  }

  const save = async () => {
    const parsed = buildPayload(form)
    if (!parsed.ok) { setMessage(parsed.error); return }

    setSaving(true)
    setMessage('')
    try {
      const url = selectedAccount === 'default'
        ? '/api/strategy'
        : `/api/strategy?accountId=${selectedAccount}`
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      if (!response.ok) { setMessage('저장에 실패했습니다.'); return }
      const res = await response.json()
      setForm(toForm(res.data ?? res))
      const label = selectedAccount === 'default'
        ? '기본값'
        : (accounts.find(a => a.id === selectedAccount)?.displayName ?? selectedAccount)
      setMessage(`${label} 전략이 저장되었습니다`)
    } catch {
      setMessage('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="card" style={{ padding: 20 }}>불러오는 중...</div>

  return (
    <div style={{ maxWidth: 920, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>전략 설정</h1>
          <p style={{ fontSize: 13, color: 'var(--text-s)' }}>6레이어 프롬프트, 콘텐츠 규칙, 인게이지먼트, 스케줄링을 설정합니다.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
          <div style={{ fontSize: 12, color: 'var(--text-s)' }}>계정별 전략</div>
          <select
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13 }}
            value={selectedAccount}
            onChange={e => { setSelectedAccount(e.target.value); setMessage('') }}
          >
            <option value="default">기본값 (공통)</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.displayName || a.username}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── 6-Layer 프롬프트 ── */}
      <div className="card" style={{ padding: 20 }}>
        <div style={sectionStyle}>6레이어 프롬프트</div>

        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <div style={labelStyle}>Layer 1: 페르소나</div>
            <textarea style={textareaStyle} rows={3} value={form.persona} onChange={e => update('persona', e.target.value)}
              placeholder="예: 20대 후반 여성 뷰티 블로거, 솔직하고 가성비를 중시하는 리뷰어" />
          </div>
          <div>
            <div style={labelStyle}>Layer 2: 타겟 오디언스</div>
            <textarea style={textareaStyle} rows={2} value={form.targetAudience} onChange={e => update('targetAudience', e.target.value)}
              placeholder="예: 20-35세 여성, 뷰티·스킨케어에 관심 있고 합리적 소비를 추구" />
          </div>
          <div>
            <div style={labelStyle}>Layer 3: 브랜드 보이스</div>
            <textarea style={textareaStyle} rows={2} value={form.brandVoice} onChange={e => update('brandVoice', e.target.value)}
              placeholder="예: 친근하지만 전문적, ~요체 사용, 이모지 최소화" />
          </div>
          <div>
            <div style={labelStyle}>Layer 4: 콘텐츠 규칙 (줄바꿈 구분)</div>
            <textarea style={textareaStyle} rows={4} value={form.contentRules} onChange={e => update('contentRules', e.target.value)}
              placeholder="첫 줄에 강력한 후킹&#10;500자 이내&#10;광고 티 최소화" />
          </div>
          <div>
            <div style={labelStyle}>Layer 5: 플랫폼 규칙 (줄바꿈 구분)</div>
            <textarea style={textareaStyle} rows={3} value={form.platformRules} onChange={e => update('platformRules', e.target.value)}
              placeholder="해시태그 최대 1개&#10;외부 링크 댓글에 배치&#10;이미지 없이 텍스트만" />
          </div>
          <div>
            <div style={labelStyle}>Layer 6: 예시 포스트 (---로 구분)</div>
            <textarea style={textareaStyle} rows={5} value={form.examplePosts} onChange={e => update('examplePosts', e.target.value)}
              placeholder="이거 써보고 진짜 놀랐는데...&#10;---&#10;솔직히 말하면 이 제품은..." />
          </div>
        </div>
      </div>

      {/* ── 기존 콘텐츠 설정 ── */}
      <div className="card" style={{ padding: 20 }}>
        <div style={sectionStyle}>콘텐츠 생성</div>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <div style={labelStyle}>시스템 프롬프트 (기본)</div>
            <textarea style={textareaStyle} rows={4} value={form.systemPromptBase} onChange={e => update('systemPromptBase', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <div style={labelStyle}>최적 글자수</div>
              <input style={inputStyle} type="number" value={form.optimalPostLength} onChange={e => update('optimalPostLength', e.target.value)} />
            </div>
            <div>
              <div style={labelStyle}>댓글 수</div>
              <select style={inputStyle} value={form.replyCount} onChange={e => update('replyCount', e.target.value)}>
                <option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option>
              </select>
            </div>
            <div>
              <div style={labelStyle}>해시태그 전략</div>
              <input style={inputStyle} value={form.hashtagStrategy} onChange={e => update('hashtagStrategy', e.target.value)} />
            </div>
          </div>
          <div>
            <div style={labelStyle}>최적 발행 시간 (쉼표 구분)</div>
            <input style={inputStyle} value={form.bestPostTimes} onChange={e => update('bestPostTimes', e.target.value)} placeholder="07:30, 20:00" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={labelStyle}>댓글 지연 최소(초)</div>
              <input style={inputStyle} type="number" value={form.commentDelayMin} onChange={e => update('commentDelayMin', e.target.value)} />
            </div>
            <div>
              <div style={labelStyle}>댓글 지연 최대(초)</div>
              <input style={inputStyle} type="number" value={form.commentDelayMax} onChange={e => update('commentDelayMax', e.target.value)} />
            </div>
          </div>
          <div>
            <div style={labelStyle}>후킹 공식 (줄바꿈 구분)</div>
            <textarea style={textareaStyle} rows={5} value={form.hookFormulas} onChange={e => update('hookFormulas', e.target.value)} />
          </div>
        </div>
      </div>

      {/* ── 콘텐츠 포맷 비율 ── */}
      <div className="card" style={{ padding: 20 }}>
        <div style={sectionStyle}>콘텐츠 포맷 비율</div>
        <p style={{ fontSize: 11, color: 'var(--text-s)', marginBottom: 12 }}>자동 생성 시 각 포맷이 선택될 상대적 가중치 (합계 100 권장)</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          {CONTENT_FORMATS.map(({ key, label }) => (
            <div key={key}>
              <div style={{ fontSize: 11, color: 'var(--text-s)', marginBottom: 4 }}>{label}</div>
              <input style={{ ...inputStyle, width: '100%' }} type="number" min="0"
                value={form.contentFormatWeights[key] ?? '0'}
                onChange={e => updateFormatWeight(key, e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      {/* ── 스마트 스케줄링 ── */}
      <div className="card" style={{ padding: 20 }}>
        <div style={sectionStyle}>스마트 스케줄링</div>
        <p style={{ fontSize: 11, color: 'var(--text-s)', marginBottom: 12 }}>요일별 자동 생성 포스트 수</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {DAY_LABELS.map((day, i) => (
            <div key={day} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: i >= 5 ? 'var(--orange)' : 'var(--text-s)', marginBottom: 4, fontWeight: 600 }}>{day}</div>
              <input style={{ ...inputStyle, textAlign: 'center', padding: '6px 4px' }} type="number" min="0"
                value={form.weekdayPostCounts[i]}
                onChange={e => updateWeekday(i, e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      {/* ── 인게이지먼트 설정 ── */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={sectionStyle}>인게이지먼트</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-s)' }}>
            <input type="checkbox" checked={form.engagementEnabled}
              onChange={e => update('engagementEnabled', e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
            활성화
          </label>
        </div>
        {form.engagementEnabled && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <div style={labelStyle}>일일 댓글 목표</div>
                <input style={inputStyle} type="number" value={form.dailyCommentTarget} onChange={e => update('dailyCommentTarget', e.target.value)} />
              </div>
              <div>
                <div style={labelStyle}>일일 좋아요 목표</div>
                <input style={inputStyle} type="number" value={form.dailyLikeTarget} onChange={e => update('dailyLikeTarget', e.target.value)} />
              </div>
              <div>
                <div style={labelStyle}>일일 팔로우 목표</div>
                <input style={inputStyle} type="number" value={form.dailyFollowTarget} onChange={e => update('dailyFollowTarget', e.target.value)} />
              </div>
            </div>
            <div>
              <div style={labelStyle}>인게이지먼트 키워드 (쉼표 구분)</div>
              <input style={inputStyle} value={form.engagementKeywords} onChange={e => update('engagementKeywords', e.target.value)}
                placeholder="뷰티, 스킨케어, 화장품 추천" />
            </div>
          </div>
        )}
      </div>

      {/* ── 저장 ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn-primary" onClick={save} disabled={saving} style={{ padding: '10px 24px', fontSize: 14 }}>
          {saving ? '저장 중...' : '설정 저장'}
        </button>
        {message && (
          <span style={{ fontSize: 13, color: message.includes('저장되었') ? 'var(--mint)' : 'var(--orange)' }}>{message}</span>
        )}
      </div>
    </div>
  )
}
