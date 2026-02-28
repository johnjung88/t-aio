'use client'
import { useEffect, useState } from 'react'
import type { StrategyConfig } from '@/lib/types'

export default function StrategyPage() {
  const [config, setConfig] = useState<StrategyConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newFormula, setNewFormula] = useState('')
  const [newTime, setNewTime] = useState('')

  useEffect(() => {
    fetch('/api/strategy').then((r) => r.json()).then(setConfig)
  }, [])

  async function handleSave() {
    if (!config) return
    setSaving(true)
    await fetch('/api/strategy', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!config) return <div style={{ color: 'var(--text-m)' }}>로딩 중...</div>

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>Threads 전략 설정</h1>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
          style={saved ? { background: 'var(--mint)' } : {}}
        >
          {saved ? '✓ 저장됨' : saving ? '저장 중...' : '저장'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* System prompt */}
        <div className="card">
          <div className="section-title">AI 시스템 프롬프트 (Threads 알고리즘 규칙)</div>
          <textarea
            className="input"
            style={{ minHeight: 200, fontFamily: 'monospace', fontSize: 12 }}
            value={config.systemPromptBase}
            onChange={(e) => setConfig((c) => c ? { ...c, systemPromptBase: e.target.value } : c)}
          />
        </div>

        {/* Hook formulas */}
        <div className="card">
          <div className="section-title">후킹 공식 목록</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {config.hookFormulas.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="input"
                  value={f}
                  onChange={(e) => {
                    const formulas = [...config.hookFormulas]
                    formulas[i] = e.target.value
                    setConfig((c) => c ? { ...c, hookFormulas: formulas } : c)
                  }}
                />
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => setConfig((c) => c ? { ...c, hookFormulas: c.hookFormulas.filter((_, j) => j !== i) } : c)}
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              placeholder="새 후킹 공식 추가..."
              value={newFormula}
              onChange={(e) => setNewFormula(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newFormula.trim()) {
                  setConfig((c) => c ? { ...c, hookFormulas: [...c.hookFormulas, newFormula.trim()] } : c)
                  setNewFormula('')
                }
              }}
            />
            <button
              className="btn btn-ghost"
              onClick={() => {
                if (!newFormula.trim()) return
                setConfig((c) => c ? { ...c, hookFormulas: [...c.hookFormulas, newFormula.trim()] } : c)
                setNewFormula('')
              }}
            >
              추가
            </button>
          </div>
        </div>

        {/* Post settings */}
        <div className="card">
          <div className="section-title">발행 설정</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-m)', marginBottom: 6 }}>최적 본글 길이 (자)</div>
              <input
                type="number"
                className="input"
                value={config.optimalPostLength}
                onChange={(e) => setConfig((c) => c ? { ...c, optimalPostLength: Number(e.target.value) } : c)}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-m)', marginBottom: 6 }}>기본 댓글 수</div>
              <select
                className="input"
                value={config.replyCount}
                onChange={(e) => setConfig((c) => c ? { ...c, replyCount: Number(e.target.value) as 0|1|2|3 } : c)}
              >
                <option value={0}>본글만</option>
                <option value={1}>본글+댓글1</option>
                <option value={2}>본글+댓글1,2</option>
                <option value={3}>본글+댓글1,2,3</option>
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ fontSize: 11, color: 'var(--text-m)', marginBottom: 6 }}>해시태그 전략</div>
              <input
                className="input"
                value={config.hashtagStrategy}
                onChange={(e) => setConfig((c) => c ? { ...c, hashtagStrategy: e.target.value } : c)}
              />
            </div>
          </div>
        </div>

        {/* Best post times */}
        <div className="card">
          <div className="section-title">최적 발행 시간대</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {config.bestPostTimes.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ padding: '4px 10px', background: 'rgba(0,200,150,0.1)', borderRadius: 8, fontSize: 12, color: 'var(--gold-l)' }}>{t}</span>
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--text-m)', cursor: 'pointer', fontSize: 14 }}
                  onClick={() => setConfig((c) => c ? { ...c, bestPostTimes: c.bestPostTimes.filter((_, j) => j !== i) } : c)}
                >×</button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="time" className="input" style={{ width: 140 }} value={newTime} onChange={(e) => setNewTime(e.target.value)} />
            <button
              className="btn btn-ghost"
              onClick={() => {
                if (!newTime) return
                setConfig((c) => c ? { ...c, bestPostTimes: [...c.bestPostTimes, newTime] } : c)
                setNewTime('')
              }}
            >추가</button>
          </div>
        </div>
      </div>
    </div>
  )
}
