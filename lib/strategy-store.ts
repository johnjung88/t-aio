import { readStore, writeStore } from './store'
import type { StrategyConfig } from './types'

export const DEFAULT_STRATEGY: StrategyConfig = {
  systemPromptBase: '',
  hookFormulas: [],
  optimalPostLength: 150,
  hashtagStrategy: '본글 마지막 1개',
  bestPostTimes: ['07:30', '20:00'],
  replyCount: 3,
  commentDelayMin: 20,
  commentDelayMax: 90,
}

// 계정별 전략 스토어: { default: StrategyConfig, [accountId]: StrategyConfig }
// 'default' 키는 공통 기본값 / 신규 계정 fallback

export function getStrategy(accountId?: string): StrategyConfig {
  const strategies = readStore<Record<string, StrategyConfig>>('strategies', {})

  if (accountId && strategies[accountId]) {
    return { ...DEFAULT_STRATEGY, ...strategies[accountId] }
  }
  if (strategies['default']) {
    return { ...DEFAULT_STRATEGY, ...strategies['default'] }
  }
  // 레거시 마이그레이션: 기존 단일 strategy.json → default로 취급
  const legacy = readStore<StrategyConfig>('strategy', DEFAULT_STRATEGY)
  return { ...DEFAULT_STRATEGY, ...legacy }
}

export function saveStrategy(accountId: string, config: StrategyConfig): void {
  const strategies = readStore<Record<string, StrategyConfig>>('strategies', {})
  strategies[accountId] = config
  writeStore('strategies', strategies)
}

export function getAllStrategies(): Record<string, StrategyConfig> {
  return readStore<Record<string, StrategyConfig>>('strategies', {})
}
