# T-AIO — 나머지 페이지 5개 구현 BRIEF

## 프로젝트 경로
/mnt/c/Users/PC/OneDrive/Desktop/t-aio/

## 작업 범위 (5개 파일만 생성)
다음 5개 파일만 생성하면 됩니다. 기존 파일은 절대 수정하지 마세요.

1. `app/posts/[id]/hooks/page.tsx`
2. `app/posts/[id]/draft/page.tsx`
3. `app/posts/[id]/schedule/page.tsx`
4. `app/posts/[id]/publish/page.tsx`
5. `app/strategy/page.tsx`

## ⚠️ HARD CONSTRAINTS (위반 시 즉시 중단)
- **Prisma 절대 사용 금지** — 스토리지는 `@/lib/store`의 `readStore` / `writeStore`만 사용
- **새 패키지 설치 금지** — package.json 수정 불가
- **기존 파일 수정 금지** — 위 5개만 신규 생성
- **모든 페이지는 `'use client'`** — App Router 클라이언트 컴포넌트

## 기존 코드 패턴 (반드시 따를 것)

### 데이터 페치 패턴
```tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ThreadPost } from '@/lib/types'

export default function SomePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [post, setPost] = useState<ThreadPost | null>(null)

  useEffect(() => {
    fetch('/api/posts').then(r => r.json()).then((posts: ThreadPost[]) => {
      setPost(posts.find(p => p.id === params.id) ?? null)
    })
  }, [params.id])
}
```

### 스타일 패턴 (CSS 변수만 사용)
```tsx
// 카드
<div className="card"> ... </div>

// 버튼
<button className="btn-primary">확인</button>
<button className="btn-secondary">취소</button>

// 색상 변수: var(--primary), var(--mint), var(--orange), var(--text), var(--text-secondary), var(--border), var(--surface-2), var(--bg)
```

## 타입 정의 (lib/types.ts 기준)
```typescript
type PostStatus = 'new' | 'hooks_ready' | 'draft' | 'scheduled' | 'published'
type HookType = 'empathy_story' | 'price_shock' | 'comparison' | 'social_proof' | 'reverse'

interface HookAngle {
  type: HookType
  label: string
  angle: string
  strength: 1 | 2 | 3 | 4 | 5
}

interface ThreadPost {
  id: string
  createdAt: string
  status: PostStatus
  contentType: 'affiliate' | 'informational' | 'personal'
  topic: string
  keywords: string[]
  account: string
  scheduledAt?: string
  publishedAt?: string
  publishedUrl?: string
  commentScheduledAt?: string
  commentPostedAt?: string
  thread: { main: string; reply1?: string; reply2?: string; reply3?: string }
  affiliateProductId?: string
  hookAngles?: HookAngle[]
  selectedHook?: string
  notes?: string
}

interface StrategyConfig {
  systemPromptBase: string
  hookFormulas: string[]
  optimalPostLength: number
  hashtagStrategy: string
  bestPostTimes: string[]
  replyCount: 0 | 1 | 2 | 3
  commentDelayMin: number
  commentDelayMax: number
}
```

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/posts | 전체 포스트 목록 |
| PATCH | /api/posts/[id] | 포스트 업데이트 |
| POST | /api/generate/hooks | 후킹 생성 body: { postId } |
| POST | /api/generate/draft | 대본 생성 body: { postId, replyCount? } |
| GET | /api/strategy | 전략 설정 조회 |
| PUT | /api/strategy | 전략 설정 저장 |
| GET | /api/accounts | 계정 목록 |

## 각 페이지 상세 스펙

### 1. app/posts/[id]/hooks/page.tsx — 후킹 각도 선택
- 페이지 로드: GET /api/posts → 해당 id 포스트 찾기, 주제 표시
- "후킹 생성" 버튼 → POST /api/generate/hooks { postId } → loading spinner
- 생성된 HookAngle[] 카드 목록 (타입 뱃지 + angle 내용 + strength 별점)
  - 타입 레이블: empathy_story="공감형썰", price_shock="충격가격비교", comparison="비교분석", social_proof="사회적증거", reverse="역발상"
- "선택" 버튼 → PATCH /api/posts/[id] { selectedHook: angle.angle, status: 'hooks_ready' }
- 직접 입력 textarea + "직접 입력으로 진행" 버튼
- "다음: 대본 작성 →" 버튼 (selectedHook 있을 때 활성) → router.push('/posts/[id]/draft')

### 2. app/posts/[id]/draft/page.tsx — 대본 에디터
- 탭: 본글 | 댓글1 | 댓글2 | 댓글3 (있는 것만)
- 본글 textarea 500자 제한 + 글자수 카운터
- "AI 전체 생성" 버튼 → POST /api/generate/draft { postId } → thread 반영
- 댓글3 탭에 안내문: "댓글3에 링크 삽입 예정 (본글에는 링크 없음)"
- "저장" 버튼 → PATCH /api/posts/[id] { thread, status: 'draft' }
- "다음: 예약 →" → router.push('/posts/[id]/schedule')

### 3. app/posts/[id]/schedule/page.tsx — 예약 설정
- datetime-local input으로 발행 시간 선택
- 최적 발행 시간 추천 버튼 (strategy.bestPostTimes 기반, 오늘 날짜로 자동 설정)
- "예약 확정" → PATCH /api/posts/[id] { scheduledAt, status: 'scheduled' }
- "다음: 발행 헬퍼 →" → router.push('/posts/[id]/publish')

### 4. app/posts/[id]/publish/page.tsx — 수동 발행 헬퍼
- 본글 텍스트 표시 + "본글 복사" 버튼 (navigator.clipboard.writeText)
- 복사 완료 시 체크 표시
- 댓글1, 댓글2, 댓글3 각각 표시 + 복사 버튼
- 주의사항: "각 댓글은 20~90초 간격으로 순차 발행하세요 (봇 탐지 방지)"
- 발행 링크 input (선택사항)
- "발행 완료" 버튼 → PATCH /api/posts/[id] { publishedAt: new Date().toISOString(), publishedUrl, status: 'published' }
- 완료 시 초록색 확인 메시지 + "포스트 목록으로 →" 링크

### 5. app/strategy/page.tsx — 전략 설정
- GET /api/strategy로 로드
- 편집 필드: systemPromptBase(textarea), optimalPostLength(number), hashtagStrategy(text), replyCount(select 0/1/2/3), bestPostTimes(text 쉼표구분), commentDelayMin/commentDelayMax(number 초단위), hookFormulas(textarea 줄바꿈구분)
- "저장" → PUT /api/strategy
- 저장 후 "설정이 저장되었습니다" 메시지

## 완성 조건
- TypeScript 오류 없음
- npm run build 통과
- 데이터 없어도 빈 화면 크래시 없음 (null 체크 필수)

---
아래는 기존 배경 정보입니다. 위 작업 범위 외 내용은 무시하세요.


## 기술 스택
- Next.js 14 App Router (TypeScript)
- 스토리지: 로컬 JSON (`data/*.json`) — `fs` 직접 사용
- AI: Anthropic Claude API (`@anthropic-ai/sdk`)
- 스케줄러: `node-cron`
- 패키지: `node-cron`, `@anthropic-ai/sdk`, `uuid` (이미 설치됨)

## 디자인 토큰 (globals.css에 반영)
```css
:root {
  --bg: #0F1729; --bg-card: rgba(255,255,255,0.035);
  --border: rgba(255,255,255,0.07); --border-glow: rgba(0,212,255,0.25);
  --primary: #00D4FF; --primary-l: #33DDFF;
  --gold: #00C896; --gold-l: #33D9AA; --mint: #34D399;
  --red: #F87171; --orange: #FB923C; --blue: #60A5FA;
  --text: #F1F5F9; --text-s: #94A3B8; --text-m: #475569;
  --sidebar-w: 220px;
}
```

## 데이터 모델 (lib/types.ts)

```typescript
type PostStatus = 'new' | 'hooks_ready' | 'draft' | 'scheduled' | 'published'
type ContentType = 'affiliate' | 'informational' | 'personal'

interface ThreadPost {
  id: string; createdAt: string; status: PostStatus; contentType: ContentType;
  topic: string; keywords: string[]; account: string;
  scheduledAt?: string; publishedAt?: string; publishedUrl?: string;
  thread: { main: string; reply1?: string; reply2?: string; reply3?: string; }
  affiliateProductId?: string;
  hookAngles?: HookAngle[];
  selectedHook?: string; notes?: string;
}

interface HookAngle {
  type: 'pain'|'curiosity'|'number'|'empathy'|'comparison';
  label: string; angle: string; strength: 1|2|3|4|5;
}

interface AffiliateProduct {
  id: string; createdAt: string; name: string; url: string;
  platform: 'coupang'|'naver'|'other'; category: string;
  price?: number; description?: string; hookKeywords?: string[];
  useCount: number; lastUsedAt?: string;
}

interface Account {
  id: string; username: string; displayName: string; niche: string;
  timezone: string; dailyPostTarget: number;
  autoGenEnabled: boolean; autoGenTime: string; categories: string[];
}

interface StrategyConfig {
  systemPromptBase: string; hookFormulas: string[];
  optimalPostLength: number; hashtagStrategy: string;
  bestPostTimes: string[]; replyCount: 0|1|2|3;
}
```

## 프로젝트 구조 (전체 생성 필요)

```
app/
  layout.tsx                  # 사이드바 포함 루트 레이아웃
  globals.css                 # 위 디자인 토큰
  page.tsx                    # redirect('/dashboard')
  dashboard/page.tsx          # 칸반 5컬럼 + 오늘 예약 + 자동생성 상태
  products/page.tsx           # 제품 목록 테이블
  products/new/page.tsx       # URL 입력 + 자동스크래핑 + 저장
  posts/page.tsx              # 포스트 목록 + 상태 필터
  posts/new/page.tsx          # 콘텐츠유형 선택, 제품선택, 계정선택
  posts/[id]/hooks/page.tsx   # AI 후킹 5개 생성 + 선택
  posts/[id]/draft/page.tsx   # 탭형 대본 에디터 + AI 생성
  posts/[id]/schedule/page.tsx # datetime-local 예약
  posts/[id]/publish/page.tsx  # 복사 버튼 UI + 발행 완료 처리
  accounts/page.tsx           # 계정 CRUD + 자동생성 ON/OFF 토글
  strategy/page.tsx           # 프롬프트/공식/시간대 편집
  api/posts/route.ts          # GET(필터), POST
  api/posts/[id]/route.ts     # GET, PATCH, DELETE
  api/products/route.ts       # GET, POST
  api/products/[id]/route.ts  # PATCH, DELETE
  api/products/suggest/route.ts # GET?accountId=
  api/scrape/route.ts         # POST {url} → {name,desc,price,platform}
  api/generate/hooks/route.ts # POST {postId} → AI 후킹 5개
  api/generate/draft/route.ts # POST {postId,replyCount} → AI 대본
  api/accounts/route.ts       # GET, POST
  api/accounts/[id]/route.ts  # PATCH, DELETE
  api/strategy/route.ts       # GET, PUT
  api/scheduler/route.ts      # GET(status), POST {action,accountId,time}
lib/
  types.ts        # 위 인터페이스
  store.ts        # readStore<T>(name,default), writeStore<T>(name,data) — fs 기반
  ai.ts           # generateText(), generateJSON<T>() — Anthropic SDK
  prompts.ts      # buildHookGenerationPrompt(), buildDraftGenerationPrompt()
  scheduler.ts    # node-cron 싱글턴: startJob(), stopJob(), getStatus(), syncWithAccounts()
  product-selector.ts # selectProductForAccount() — useCount 기준 로테이션
components/
  Sidebar.tsx     # 고정 사이드바, usePathname 활성화 표시
data/             # 초기 JSON 파일 생성
  posts.json      # []
  affiliates.json # []
  accounts.json   # [{ id:"default", username:"my_threads", ... }]
  strategy.json   # 기본 Threads 전략 규칙
```

## AI 프롬프트 구조

### 후킹 생성
- 입력: 제품정보 + strategy.systemPromptBase + hookFormulas
- 출력: HookAngle[] JSON (5개, type별 1개씩)

### 대본 생성
- 입력: 선택된 후킹 + 제품정보 + replyCount
- 출력: { main, reply1?, reply2?, reply3? } JSON
- 본글: optimalPostLength(150)자 이내, 링크 금지
- 댓글3: 어필리에이트 링크 포함 CTA

## 자동 스케줄러
- 계정별 autoGenTime에 cron 실행
- 실행 순서: 상품 자동선택 → 후킹 AI → 대본 AI → posts.json에 저장 + useCount 증가
- API: POST /api/scheduler { action: 'toggle'|'start'|'stop'|'sync', accountId, time }

## UI 규칙
- 다크 배경 (#0F1729), 사이드바 고정 (220px)
- 'use client' 최소화, 데이터는 API fetch
- 글자수 카운터: 500자 제한 (본글/댓글 공통)
- 500자 초과 시 빨간색, 450자 이상 주황색
- 발행 페이지: 클립보드 복사 버튼 (각 탭별)
- 카드 컴포넌트: bg-card + border + border-radius:12px 패턴
- 버튼: btn-primary(cyan), btn-ghost(투명), btn-danger(빨간)

## 환경변수
```
ANTHROPIC_API_KEY=  # 필수
```
`.env.local`에서 읽음.

## 완료 기준
1. `npm run build` 에러 없음
2. `npm run dev` 후 localhost:3000 → /dashboard 리다이렉트
3. 제품 추가 → 후킹 생성 → 대본 생성 → 발행 복사 워크플로우 작동
4. data/*.json 파일 정상 쓰기

---

## PHASE 2: AIO 규칙 준수 리팩터링

### 작업 대상 파일
아래 파일들만 수정. 페이지 파일(app/*/page.tsx)은 건드리지 마세요.

**API 라우트 (11개):**
- app/api/posts/route.ts
- app/api/posts/[id]/route.ts
- app/api/products/route.ts
- app/api/products/[id]/route.ts
- app/api/products/suggest/route.ts
- app/api/scrape/route.ts
- app/api/generate/hooks/route.ts
- app/api/generate/draft/route.ts
- app/api/accounts/route.ts
- app/api/accounts/[id]/route.ts
- app/api/strategy/route.ts

**lib 파일 (2개):**
- lib/types.ts (updatedAt 추가)
- lib/store.ts (필요 시 updatedAt 자동 설정 헬퍼)

### 변경 사항

#### 1. API 응답 표준화
모든 API 응답을 `{ success: true, data: T }` 또는 `{ success: false, error: string }` 형식으로 변경

예시:
```typescript
// Before
return NextResponse.json(data)
return NextResponse.json({ error: 'Not found' }, { status: 404 })

// After
return NextResponse.json({ success: true, data })
return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
```

#### 2. Zod 입력 검증
zod는 이미 설치되어 있지 않으므로 설치 필요: `npm install zod`
각 API의 request body에 Zod 스키마 적용

예시:
```typescript
import { z } from 'zod'

const CreatePostSchema = z.object({
  topic: z.string().min(1),
  contentType: z.enum(['affiliate', 'informational', 'personal']),
  account: z.string().min(1),
  affiliateProductId: z.string().optional(),
  keywords: z.array(z.string()).optional(),
})

// POST handler 내부
const parsed = CreatePostSchema.safeParse(body)
if (!parsed.success) {
  return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
}
```

#### 3. updatedAt 필드 추가
lib/types.ts의 ThreadPost, AffiliateProduct, Account에 `updatedAt: string` 필드 추가
PATCH/PUT 시 자동으로 `updatedAt: new Date().toISOString()` 설정

### 중요 제약
- 페이지 파일(page.tsx) 수정 금지 — API 응답 형식이 바뀌면 프론트에서 `.data` 필드 접근 필요하나, 이 작업은 별도로 처리
- npm run build가 통과해야 함
- 기존 GET 응답 data 타입 정확히 유지
