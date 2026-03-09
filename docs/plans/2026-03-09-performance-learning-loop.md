# 성과 기반 학습 루프 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 발행된 포스트의 성과 데이터를 분석해 AI 프롬프트 Layer 7로 자동 주입, 데이터 ≥ 5개일 때 자동 활성화

**Architecture:** 성과 수집 cron 실행 시 `computeInsights()`가 `data/strategy-insights.json`을 갱신. 생성 API는 이 파일을 읽어 Layer 7에 주입. 데이터 부족 시 Layer 7 생략 (cold start 안전).

**Tech Stack:** TypeScript, Next.js App Router, `lib/store.ts`(readStore/writeStore), `lib/prompts.ts`, `lib/scheduler.ts`

---

### Task 1: lib/insights.ts 생성

**Files:**
- Create: `lib/insights.ts`

**Step 1: 파일 생성**

```typescript
import { readStore, writeStore } from './store'
import type { ThreadPost } from './types'
import type { ContentFormat, HookType } from './types'

export interface StrategyInsights {
  accountId: string
  computedAt: string
  dataPoints: number  // 성과 데이터 있는 포스트 수
  topHookTypes: { type: HookType; avgScore: number; count: number }[]
  topContentFormats: { format: ContentFormat; avgScore: number; count: number }[]
  topPosts: { score: number; text: string; hookType?: string; format?: string }[]
}

// score = likes×2 + replies×3 + reposts×4
function calcScore(perf: { likes: number; replies: number; reposts: number }): number {
  return perf.likes * 2 + perf.replies * 3 + perf.reposts * 4
}

export function computeInsights(accountId: string): void {
  const posts = readStore<ThreadPost[]>('posts', [])
  const published = posts.filter(
    p => p.account === accountId && p.status === 'published' && p.performanceHistory?.length
  )

  if (published.length < 5) {
    // 데이터 부족 — 파일 삭제 또는 미생성
    return
  }

  // 포스트별 최신 성과 점수 계산
  const scored = published.map(p => {
    const latest = p.performanceHistory![p.performanceHistory!.length - 1]
    const score = calcScore(latest)
    return { post: p, score }
  }).sort((a, b) => b.score - a.score)

  // 훅 타입별 평균 점수
  const hookMap = new Map<string, { total: number; count: number }>()
  for (const { post, score } of scored) {
    const hookType = (post.selectedHook ? post.hookAngles?.find(h => h.angle === post.selectedHook)?.type : undefined) as string | undefined
    if (!hookType) continue
    const cur = hookMap.get(hookType) ?? { total: 0, count: 0 }
    hookMap.set(hookType, { total: cur.total + score, count: cur.count + 1 })
  }
  const topHookTypes = Array.from(hookMap.entries())
    .map(([type, { total, count }]) => ({ type: type as HookType, avgScore: Math.round(total / count * 10) / 10, count }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 3)

  // 콘텐츠 포맷별 평균 점수
  const formatMap = new Map<string, { total: number; count: number }>()
  for (const { post, score } of scored) {
    if (!post.contentFormat) continue
    const cur = formatMap.get(post.contentFormat) ?? { total: 0, count: 0 }
    formatMap.set(post.contentFormat, { total: cur.total + score, count: cur.count + 1 })
  }
  const topContentFormats = Array.from(formatMap.entries())
    .map(([format, { total, count }]) => ({ format: format as ContentFormat, avgScore: Math.round(total / count * 10) / 10, count }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 3)

  // 상위 3개 포스트 텍스트 추출
  const topPosts = scored.slice(0, 3).map(({ post, score }) => ({
    score,
    text: post.thread.main.slice(0, 120),
    hookType: (post.hookAngles?.find(h => h.angle === post.selectedHook)?.type) as string | undefined,
    format: post.contentFormat,
  }))

  const insights: StrategyInsights = {
    accountId,
    computedAt: new Date().toISOString(),
    dataPoints: published.length,
    topHookTypes,
    topContentFormats,
    topPosts,
  }

  writeStore(`strategy-insights-${accountId}`, insights)
  console.log(`[Insights] 계산 완료: ${accountId} (데이터 ${published.length}개)`)
}

export function loadInsights(accountId: string): StrategyInsights | null {
  try {
    const insights = readStore<StrategyInsights>(`strategy-insights-${accountId}`, null as unknown as StrategyInsights)
    if (!insights || insights.dataPoints < 5) return null
    return insights
  } catch {
    return null
  }
}
```

**Step 2: TypeScript 타입 검사**

```bash
npx tsc --noEmit
```

기대 결과: 에러 없음

**Step 3: 커밋**

```bash
git add lib/insights.ts
git commit -m "feat(insights): computeInsights / loadInsights 구현"
```

---

### Task 2: lib/prompts.ts — Layer 7 추가

**Files:**
- Modify: `lib/prompts.ts`

**Step 1: import 추가 (파일 상단)**

```typescript
import type { StrategyInsights } from './insights'
```

**Step 2: buildHookGenerationPrompt 시그니처 변경**

기존:
```typescript
export function buildHookGenerationPrompt(
  product: AffiliateProduct | null,
  topic: string,
  strategy: StrategyConfig
): string {
```

변경 후:
```typescript
export function buildHookGenerationPrompt(
  product: AffiliateProduct | null,
  topic: string,
  strategy: StrategyConfig,
  insights?: StrategyInsights | null
): string {
```

**Step 3: buildHookGenerationPrompt 내부 — return 직전에 Layer 7 삽입**

기존 return 문 앞에 추가:
```typescript
  const layer7 = buildInsightsLayer(insights)

  return `당신은 한국 스레드(Threads) 어필리에이트 마케팅 전문 카피라이터입니다.

${layers}${layer7}

[제품/주제 정보]
...
```

실제로는 기존 return 문자열 내 `${layers}` 바로 뒤에 `${layer7}`을 추가.

**Step 4: buildDraftGenerationPrompt 시그니처 변경**

기존:
```typescript
export function buildDraftGenerationPrompt(
  product: AffiliateProduct | null,
  topic: string,
  selectedHook: string,
  replyCount: number,
  strategy: StrategyConfig,
  contentFormat?: ContentFormat
): string {
```

변경 후:
```typescript
export function buildDraftGenerationPrompt(
  product: AffiliateProduct | null,
  topic: string,
  selectedHook: string,
  replyCount: number,
  strategy: StrategyConfig,
  contentFormat?: ContentFormat,
  insights?: StrategyInsights | null
): string {
```

동일하게 return 문자열 내 `${layers}` 뒤에 `${layer7}` 추가.

**Step 5: buildInsightsLayer 헬퍼 추가 (파일 하단)**

```typescript
function buildInsightsLayer(insights?: StrategyInsights | null): string {
  if (!insights || insights.dataPoints < 5) return ''

  const lines: string[] = []
  lines.push(`\n\n[Layer 7: 성과 기반 학습 — ${insights.dataPoints}개 포스트 분석]`)

  if (insights.topHookTypes.length) {
    const best = insights.topHookTypes[0]
    lines.push(`- 최고 성과 훅 타입: ${best.type} (평균 점수 ${best.avgScore}, ${best.count}회)`)
  }
  if (insights.topContentFormats.length) {
    const best = insights.topContentFormats[0]
    lines.push(`- 최고 성과 포맷: ${best.format} (평균 점수 ${best.avgScore})`)
  }
  if (insights.topPosts.length) {
    lines.push(`- 상위 포스트 예시:`)
    for (const p of insights.topPosts) {
      lines.push(`  "${p.text}"`)
    }
  }
  lines.push(`→ 위 패턴을 우선 활용하되, 단조롭지 않게 변형할 것`)

  return lines.join('\n')
}
```

**Step 6: TypeScript 타입 검사**

```bash
npx tsc --noEmit
```

**Step 7: 커밋**

```bash
git add lib/prompts.ts
git commit -m "feat(prompts): Layer 7 성과 기반 학습 주입 추가"
```

---

### Task 3: lib/scheduler.ts — computeInsights 연동

**Files:**
- Modify: `lib/scheduler.ts`

**Step 1: import 추가**

파일 상단 import에 추가:
```typescript
import { computeInsights } from './insights'
```

**Step 2: runPerformanceCollection 끝에 추가**

기존:
```typescript
    if (res.ok) {
      console.log(`[Scheduler] 성과수집 완료: ${accountId}`)
    }
```

변경 후:
```typescript
    if (res.ok) {
      console.log(`[Scheduler] 성과수집 완료: ${accountId}`)
      computeInsights(accountId)
    }
```

**Step 3: TypeScript 타입 검사**

```bash
npx tsc --noEmit
```

**Step 4: 커밋**

```bash
git add lib/scheduler.ts
git commit -m "feat(scheduler): 성과 수집 후 insights 자동 계산 연동"
```

---

### Task 4: app/api/generate/hooks/route.ts — insights 주입

**Files:**
- Modify: `app/api/generate/hooks/route.ts`

**Step 1: import 추가**

```typescript
import { loadInsights } from '@/lib/insights'
```

**Step 2: insights 로드 후 buildHookGenerationPrompt에 전달**

기존:
```typescript
const hooks = await generateJSON<HookAngle[]>(buildHookGenerationPrompt(product, post.topic, strategy))
```

변경 후:
```typescript
const insights = loadInsights(account.id)
const hooks = await generateJSON<HookAngle[]>(buildHookGenerationPrompt(product, post.topic, strategy, insights))
```

(account를 읽는 코드가 없다면 `readStore<Account[]>('accounts', []).find(a => a.id === post.account)` 추가)

**Step 3: TypeScript 타입 검사**

```bash
npx tsc --noEmit
```

**Step 4: 커밋**

```bash
git add app/api/generate/hooks/route.ts
git commit -m "feat(api): hooks 생성 시 insights Layer 7 주입"
```

---

### Task 5: app/api/generate/draft/route.ts — insights 주입

**Files:**
- Modify: `app/api/generate/draft/route.ts`

**Step 1: import 추가**

```typescript
import { loadInsights } from '@/lib/insights'
```

**Step 2: insights 로드 후 buildDraftGenerationPrompt에 전달**

기존 `buildDraftGenerationPrompt` 호출 마지막 인자 뒤에 `insights` 추가:
```typescript
const insights = loadInsights(account.id)
const draft = await generateJSON<...>(
  buildDraftGenerationPrompt(product, post.topic, selectedHook, replyCount, strategy, contentFormat, insights)
)
```

**Step 3: TypeScript 타입 검사**

```bash
npx tsc --noEmit
```

**Step 4: 서버 재시작 후 수동 검증**

```bash
# 서버 재시작 (포트 4000 kill 후 재시작)
# 데이터 없을 때 — Layer 7 없이 기존과 동일하게 동작해야 함
curl -X POST http://localhost:4000/api/generate/hooks \
  -H "Content-Type: application/json" \
  -d '{"postId": "<any_post_id>"}'
# 기대: success:true, hooks 5개 반환

# 테스트용 인사이트 파일 수동 생성 (Layer 7 활성화 확인용)
node -e "
const { writeStore } = require('./lib/store');
writeStore('strategy-insights-3a25908c-e312-4f92-8782-622367161fa1', {
  accountId: '3a25908c-e312-4f92-8782-622367161fa1',
  computedAt: new Date().toISOString(),
  dataPoints: 10,
  topHookTypes: [{ type: 'reverse', avgScore: 45.2, count: 3 }],
  topContentFormats: [{ format: 'story', avgScore: 42.0, count: 4 }],
  topPosts: [{ score: 85, text: '엄마가 싸구려라고 말렸는데 오히려 좋았음' }]
});
"
# 재호출 후 응답의 hooks에 역발상 패턴이 강화됐는지 확인
```

**Step 5: 최종 커밋**

```bash
git add app/api/generate/draft/route.ts
git commit -m "feat(api): draft 생성 시 insights Layer 7 주입"
```

---

## 검증 체크리스트

- [ ] `npx tsc --noEmit` — 에러 없음
- [ ] 데이터 0개: Layer 7 없이 기존과 동일 동작
- [ ] 데이터 5개 이상: `data/strategy-insights-<accountId>.json` 자동 생성
- [ ] 인사이트 있을 때 hooks API 응답 — reverse/story 패턴 강화 확인
- [ ] 성과 수집 cron 실행 시 `[Insights] 계산 완료` 로그 출력
