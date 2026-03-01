# T-AIO — Claude Code 프로젝트 가이드

## 프로젝트 개요
Threads 어필리에이트 자동화 도구. Next.js 14 App Router + 로컬 JSON 스토리지.

## 기술 스택
- **Framework**: Next.js 14 App Router (TypeScript)
- **Storage**: 로컬 JSON (`data/*.json`) — `lib/store.ts`의 `readStore` / `writeStore` 사용
- **AI**: Anthropic Claude API (`@anthropic-ai/sdk`) — `lib/ai.ts`
- **Validation**: Zod (`lib/schemas.ts`)
- **Scheduler**: `node-cron` (`lib/scheduler.ts`)

## HARD CONSTRAINTS (절대 위반 금지)

1. **Prisma 절대 사용 금지** — DB 없음, `readStore`/`writeStore`만 사용
2. **새 패키지 설치 금지** — package.json 수정 불가 (이미 설치된 패키지만 사용)
3. **모든 페이지는 `'use client'`** — App Router 클라이언트 컴포넌트
4. **CSS 변수만 사용** — Tailwind 클래스 없음, `var(--primary)` 등 전용 변수 사용
5. **null 체크 필수** — 데이터 없어도 크래시 없어야 함

## 데이터 패턴

### 스토리지 읽기/쓰기
```typescript
import { readStore, writeStore } from '@/lib/store'

const posts = readStore<ThreadPost[]>('posts', [])
writeStore('posts', updatedPosts)
```

### API 응답 표준 형식
모든 API는 `lib/api.ts`의 `ok()` / `fail()` 헬퍼를 통해 응답:
```typescript
import { ok, fail } from '@/lib/api'

// 성공
return ok(data)                        // { success: true, data, error: null }
// 실패
return fail('Not found', 404, 'NOT_FOUND')  // { success: false, data: null, error: {...} }
```

프론트에서 접근: `const res = await fetch(...).then(r => r.json()); res.data`

### 페이지 데이터 페치 패턴
```typescript
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ThreadPost } from '@/lib/types'

export default function SomePage({ params }: { params: { id: string } }) {
  const [post, setPost] = useState<ThreadPost | null>(null)
  useEffect(() => {
    fetch('/api/posts').then(r => r.json()).then(res => {
      setPost((res.data ?? []).find((p: ThreadPost) => p.id === params.id) ?? null)
    })
  }, [params.id])
}
```

## CSS 변수 (globals.css)
```css
--bg: #0F1729          /* 배경 */
--bg-card / .card      /* 카드 컴포넌트 */
--primary: #00D4FF     /* 시안 강조색 */
--mint: #34D399        /* 그린 */
--orange: #FB923C      /* 경고/주황 */
--text: #F1F5F9        /* 기본 텍스트 */
--text-s / --text-secondary: #94A3B8  /* 보조 텍스트 */
--border               /* 테두리 */
--surface-2            /* 2차 배경 */
```

클래스: `.card`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`

## 디렉토리 구조
```
app/
  dashboard/page.tsx   # 칸반 5컬럼 + 오늘 예약 + rate limit
  posts/               # 포스트 CRUD + 워크플로우
  products/            # 어필리에이트 제품 관리
  accounts/            # Threads 계정 관리
  strategy/page.tsx    # AI 프롬프트/전략 설정
  api/                 # 11개 API 라우트
lib/
  types.ts    # 핵심 인터페이스 (ThreadPost, AffiliateProduct, Account, StrategyConfig)
  store.ts    # readStore<T>(name, default) / writeStore<T>(name, data)
  ai.ts       # generateText() / generateJSON<T>() — claude-sonnet-4-6
  prompts.ts  # buildHookGenerationPrompt() / buildDraftGenerationPrompt()
  schemas.ts  # Zod 스키마 (API 입력 검증)
  api.ts      # ok() / fail() — API 응답 헬퍼
  entities.ts # 엔티티 정규화 유틸
data/         # posts.json, affiliates.json, accounts.json, strategy.json
```

## 핵심 타입
- `PostStatus`: `'new' | 'hooks_ready' | 'draft' | 'scheduled' | 'published'`
- `HookType`: `'empathy_story' | 'price_shock' | 'comparison' | 'social_proof' | 'reverse'`
- `ThreadPost.thread`: `{ main, reply1?, reply2?, reply3? }`
- 모든 엔티티에 `createdAt`, `updatedAt` 포함

## API 엔드포인트
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET/POST | /api/posts | 포스트 목록/생성 |
| GET/PATCH/DELETE | /api/posts/[id] | 포스트 상세 |
| GET/POST | /api/products | 제품 목록/생성 |
| POST | /api/generate/hooks | AI 후킹 5개 생성 `{ postId }` |
| POST | /api/generate/draft | AI 대본 생성 `{ postId, replyCount? }` |
| GET/PUT | /api/strategy | 전략 설정 |
| GET/POST | /api/accounts | 계정 관리 |
| GET/POST | /api/scheduler | 스케줄러 상태/제어 |

## 개발 서버
- `npm run dev` → localhost:4000 (`package.json`에 포트 설정됨)
- `/` → `/dashboard` 자동 리다이렉트
