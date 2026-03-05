# T-AIO 아키텍처 & 워크플로우 정리

## 1. 프로젝트 개요

**T-AIO (Threads All-In-One)** — Threads 어필리에이트 콘텐츠를 AI로 생성하고, 브라우저 자동화로 발행까지 하는 풀스택 자동화 도구.

| 항목 | 내용 |
|------|------|
| **프레임워크** | Next.js 14 App Router (TypeScript) |
| **포트** | localhost:4000 |
| **스토리지** | 로컬 JSON 파일 (`data/*.json`) — DB 없음 |
| **AI** | Anthropic Claude API (`claude-sonnet-4-6`) |
| **브라우저 자동화** | Pinchtab (Chromium 프로필 격리, headless) |
| **스케줄러** | node-cron (KST 기반 자동 발행) |
| **검증** | Zod 스키마 (API 입력 검증) |

---

## 2. 전체 워크플로우

```
┌─────────────────────────────────────────────────────────────────┐
│                     T-AIO 콘텐츠 파이프라인                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ① 제품 등록          어필리에이트 제품 정보 입력                    │
│       │               (쿠팡/네이버/기타, 가격, 키워드)              │
│       ▼                                                         │
│  ② 포스트 생성        제품 연결 + 주제/키워드 설정                   │
│       │               status: 'new'                              │
│       ▼                                                         │
│  ③ AI 후킹 생성       5가지 각도로 첫 문장 생성                     │
│       │               (공감형/가격충격/비교/사회증거/역발상)           │
│       │               status: 'hooks_ready'                      │
│       ▼                                                         │
│  ④ AI 대본 생성       선택된 후킹 → 본글 + 댓글 1~3개 생성          │
│       │               status: 'draft'                            │
│       ▼                                                         │
│  ⑤ 스케줄 예약        발행 시간 지정                               │
│       │               status: 'scheduled'                        │
│       ▼                                                         │
│  ⑥ 자동 발행          Pinchtab으로 Threads에 본글 게시              │
│       │               status: 'published'                        │
│       ▼                                                         │
│  ⑦ 댓글 자동추가      랜덤 딜레이(20~90초) 후 reply1→2→3 순서 발행  │
│                       (봇 탐지 회피)                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 수동 vs 자동

| 모드 | 설명 |
|------|------|
| **수동** | UI에서 각 단계를 직접 진행 (후킹 생성 → 후킹 선택 → 대본 생성 → 스케줄) |
| **자동** | 스케줄러가 cron 기반으로 ②~⑦ 전체를 자동 실행 (계정별 설정 시간) |

---

## 3. 디렉토리 구조

```
t-aio/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # / → /dashboard 리다이렉트
│   ├── layout.tsx                # 루트 레이아웃
│   ├── globals.css               # CSS 변수 + 커스텀 클래스
│   │
│   ├── dashboard/page.tsx        # 칸반 보드 (5컬럼) + rate limit 미터
│   ├── posts/
│   │   ├── page.tsx              # 포스트 목록
│   │   ├── new/page.tsx          # 포스트 생성
│   │   └── [id]/
│   │       ├── hooks/page.tsx    # AI 후킹 생성 & 선택
│   │       ├── draft/page.tsx    # AI 대본 생성 & 편집
│   │       ├── schedule/page.tsx # 발행 시간 예약
│   │       └── publish/page.tsx  # 발행 실행
│   ├── products/
│   │   ├── page.tsx              # 제품 목록
│   │   └── new/page.tsx          # 제품 등록
│   ├── accounts/page.tsx         # 계정 관리 (로그인 정보 포함)
│   ├── strategy/page.tsx         # AI 전략 설정
│   │
│   └── api/                      # API 라우트 (12개)
│       ├── posts/route.ts        # GET: 목록, POST: 생성
│       ├── posts/[id]/route.ts   # GET/PATCH/DELETE
│       ├── products/route.ts     # GET: 목록, POST: 생성
│       ├── products/[id]/route.ts# GET/PATCH/DELETE
│       ├── products/suggest/route.ts # 계정별 제품 추천
│       ├── accounts/route.ts     # GET/POST
│       ├── accounts/[id]/route.ts# GET/PATCH/DELETE
│       ├── generate/hooks/route.ts  # AI 후킹 5개 생성
│       ├── generate/draft/route.ts  # AI 대본 생성
│       ├── strategy/route.ts     # GET/PUT
│       ├── scheduler/route.ts    # GET: 상태, POST: start/stop
│       └── scrape/route.ts       # URL 스크래핑
│
├── lib/                          # 핵심 비즈니스 로직
│   ├── types.ts                  # 타입 정의 (5개 인터페이스)
│   ├── store.ts                  # JSON 파일 읽기/쓰기
│   ├── ai.ts                     # Claude API 호출 (generateText/generateJSON)
│   ├── prompts.ts                # AI 프롬프트 템플릿
│   ├── schemas.ts                # Zod 검증 스키마
│   ├── api.ts                    # API 응답 헬퍼 (ok/fail)
│   ├── entities.ts               # 엔티티 정규화 (타임스탬프 보정)
│   ├── product-selector.ts       # 계정별 제품 선택 알고리즘
│   ├── scheduler.ts              # cron 스케줄러 (자동 생성 + 발행)
│   ├── threads-bot.ts            # Threads 발행/답글 자동화
│   ├── pinchtab.ts               # Pinchtab 브라우저 API 래퍼
│   ├── object.ts                 # 유틸리티
│   └── zod.ts                    # Zod re-export
│
├── data/                         # JSON 스토리지
│   ├── posts.json                # 포스트 데이터
│   ├── affiliates.json           # 어필리에이트 제품
│   ├── accounts.json             # Threads 계정
│   └── strategy.json             # AI 전략 설정
│
└── __tests__/                    # 테스트
    ├── unit/                     # 단위 테스트
    └── e2e/                      # E2E 테스트 (Pinchtab 연동)
```

---

## 4. 핵심 데이터 모델

### ThreadPost (포스트)

```typescript
{
  id: string
  status: 'new' | 'hooks_ready' | 'draft' | 'scheduled' | 'published'
  contentType: 'affiliate' | 'informational' | 'personal'
  topic: string                    // 주제
  keywords: string[]               // 키워드
  account: string                  // 계정 ID
  thread: {
    main: string                   // 본글
    reply1?: string                // 댓글 1 (핵심 정보)
    reply2?: string                // 댓글 2 (사용 예시)
    reply3?: string                // 댓글 3 (CTA + 링크 안내)
  }
  affiliateProductId?: string      // 연결된 제품
  hookAngles?: HookAngle[]         // AI 생성 후킹 5개
  selectedHook?: string            // 선택된 후킹 문장
  scheduledAt?: string             // 예약 시간
  publishedAt?: string             // 발행 시간
  publishedUrl?: string            // Threads 게시 URL
  commentScheduledAt?: string      // 댓글 예약 시각
  commentPostedAt?: string         // 댓글 완료 시각
}
```

### HookAngle (AI 후킹 각도)

```typescript
{
  type: 'empathy_story' | 'price_shock' | 'comparison' | 'social_proof' | 'reverse'
  label: string      // 예: "공감형 썰", "충격 가격 비교"
  angle: string      // 실제 후킹 문장
  strength: 1~5      // 예상 후킹 강도
}
```

### AffiliateProduct (어필리에이트 제품)

```typescript
{
  id: string
  name: string                     // 제품명
  url: string                      // 어필리에이트 링크
  platform: 'coupang' | 'naver' | 'other'
  category: string                 // 카테고리
  price?: number                   // 판매가
  originalPrice?: number           // 원가 (할인율 계산용)
  description?: string
  hookKeywords?: string[]          // 후킹용 키워드
  useCount: number                 // 사용 횟수 (균등 분배용)
  lastUsedAt?: string
}
```

### Account (Threads 계정)

```typescript
{
  id: string
  username: string                 // @username
  displayName: string
  niche: string                    // 니치 (예: "뷰티", "테크")
  categories: string[]             // 담당 카테고리
  dailyPostTarget: number          // 일일 목표
  autoGenEnabled: boolean          // 자동 생성 활성화
  autoGenTime: string              // 자동 생성 시간 ("HH:MM")
  todayPostCount: number           // 오늘 발행 수
  todayPostDate: string            // 날짜 (자정 리셋)
  loginMethod: 'direct' | 'google' // 로그인 방식
  loginEmail?: string
  loginPassword?: string
}
```

### StrategyConfig (AI 전략 설정)

```typescript
{
  systemPromptBase: string         // AI 시스템 프롬프트
  hookFormulas: string[]           // 후킹 공식 리스트
  optimalPostLength: number        // 최적 글 길이 (기본 150자)
  hashtagStrategy: string          // 해시태그 전략
  bestPostTimes: string[]          // 최적 발행 시간
  replyCount: 0 | 1 | 2 | 3       // 댓글 수
  commentDelayMin: number          // 최소 딜레이 (초, 기본 20)
  commentDelayMax: number          // 최대 딜레이 (초, 기본 90)
}
```

---

## 5. 레이어별 상세

### 5-1. 스토리지 레이어 (`lib/store.ts`)

DB 없이 로컬 JSON 파일로 동작. 모든 데이터는 `data/` 폴더에 저장.

```typescript
readStore<T>(name, defaultValue)  // data/{name}.json 읽기
writeStore<T>(name, data)         // data/{name}.json 쓰기
```

- 파일 없으면 자동 생성 (defaultValue로 초기화)
- JSON 파싱 실패 시 defaultValue 반환 (크래시 방지)

### 5-2. AI 레이어 (`lib/ai.ts` + `lib/prompts.ts`)

**ai.ts** — Claude API 호출 래퍼:
- `generateText(prompt)` → 텍스트 응답
- `generateJSON<T>(prompt)` → JSON 파싱된 응답 (마크다운 코드블록 자동 제거)

**prompts.ts** — 두 가지 프롬프트 템플릿:

| 함수 | 용도 | 입력 | 출력 |
|------|------|------|------|
| `buildHookGenerationPrompt()` | 후킹 5개 생성 | 제품+주제+전략 | `HookAngle[]` (5개) |
| `buildDraftGenerationPrompt()` | 스레드 대본 생성 | 제품+후킹+전략 | `{ main, reply1?, reply2?, reply3? }` |

**프롬프트 특징:**
- 한국 어필리에이트 특화 5가지 후킹 각도 (공감/가격충격/비교/사회증거/역발상)
- Threads 알고리즘 규칙 반영 (URL 미포함, 해시태그 1개, 구어체)
- strategy.systemPromptBase를 시스템 프롬프트로 주입

### 5-3. API 레이어 (`lib/api.ts` + `lib/schemas.ts`)

**표준 응답 포맷:**
```typescript
// 성공
{ success: true,  data: T,    error: null }
// 실패
{ success: false, data: null,  error: { code, message, details? } }
```

**Zod 검증:** 모든 POST/PATCH 요청은 Zod 스키마로 검증 후 처리.

### 5-4. 브라우저 자동화 레이어

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ scheduler.ts │────▶│ threads-bot  │────▶│  pinchtab.ts │
│  (cron 트리거) │     │  (발행 로직)   │     │  (브라우저 API) │
└──────────────┘     └──────────────┘     └──────────────┘
                                                  │
                                          ┌───────▼───────┐
                                          │ Pinchtab 서버   │
                                          │ (localhost:9867)│
                                          │  Chromium 인스턴스│
                                          └───────────────┘
```

**pinchtab.ts** — Pinchtab HTTP API 래퍼:
- 서버 관리: `ensureServer()` (없으면 자동 시작)
- 프로필 관리: `ensureProfile(name)` (계정별 격리된 브라우저 프로필)
- 인스턴스: `startInstance(profileId)` / `stopInstance(instanceId)`
- 탭 조작: `openTab()`, `navigate()`, `snapshot()`, `click()`, `fill()`, `type()`
- 대기: `waitForRef(matcher, timeout)` — 요소가 나타날 때까지 폴링
- JS 실행: `evaluate(tabId, expression)` — 페이지 내 JS 실행

**threads-bot.ts** — Threads 전용 자동화:
- `ensureLoggedIn()` — 로그인 페이지 감지 → 자동 로그인
  - Instagram 계정 선택 버튼 감지 (기존 세션)
  - email/password 직접 입력 (신규 로그인)
- `publishPost(post)` — 본글 발행 플로우:
  1. Pinchtab 서버 확인/시작
  2. 프로필별 브라우저 인스턴스 시작
  3. threads.net 접속 → 로그인 확인
  4. "Create" 버튼 클릭 → 에디터에 본글 입력 → "게시" 클릭
  5. 발행 URL 추출
- `publishReply(post, replyText)` — 댓글 발행 플로우:
  1. 발행된 포스트 URL로 이동
  2. 답글 텍스트박스 찾기 → 댓글 입력 → "게시" 클릭

### 5-5. 스케줄러 레이어 (`lib/scheduler.ts`)

**자동 생성+발행 전체 파이프라인:**

```
[cron 트리거] → runAutoGen(accountId)
  ├─ 계정 확인 (autoGenEnabled?)
  ├─ 제품 선택 (라운드로빈: useCount 낮은 순)
  ├─ AI 후킹 생성 (5개) → 최고 strength 선택
  ├─ AI 대본 생성 (본글 + 댓글)
  ├─ Rate limit 체크 (250/24h per account)
  ├─ 포스트 저장 (status: 'draft')
  ├─ Threads 본글 발행 → status: 'published'
  ├─ 제품 useCount 업데이트
  └─ 댓글 자동추가 예약 (비동기, 랜덤 딜레이 후 reply1→2→3)
```

**봇 탐지 회피 전략:**
- 댓글 딜레이: 본글 발행 후 20~90초 랜덤 대기
- 댓글 간 딜레이: 각 댓글 사이에도 20~90초 랜덤 대기
- Rate limit: 계정당 250포스트/24시간 제한 (날짜 변경 시 자동 리셋)

**제품 선택 알고리즘** (`lib/product-selector.ts`):
1. 계정의 카테고리에 맞는 제품 필터링
2. useCount 낮은 순 정렬 (균등 분배)
3. 같은 useCount면 lastUsedAt이 오래된 순

---

## 6. UI 페이지 구성

### 대시보드 (`/dashboard`)
- **칸반 보드**: 5컬럼 (신규 → 후킹완료 → 초안완료 → 예약됨 → 발행완료)
- **Rate Limit 미터**: 계정별 오늘 발행량 / 250 프로그레스바
- **오늘 예약**: 오늘 날짜에 예약된 포스트 목록
- **계정 필터**: 전체 / 개별 계정별 보기

### 포스트 워크플로우 (`/posts/[id]/*`)
| 단계 | 페이지 | 동작 |
|------|--------|------|
| 생성 | `/posts/new` | 주제, 키워드, 계정, 제품 선택 |
| 후킹 | `/posts/[id]/hooks` | AI 후킹 5개 생성 → 하나 선택 |
| 대본 | `/posts/[id]/draft` | AI 대본 생성 → 수동 편집 가능 |
| 예약 | `/posts/[id]/schedule` | 발행 시간 설정 |
| 발행 | `/posts/[id]/publish` | Pinchtab 통해 Threads 발행 실행 |

### 제품 관리 (`/products`)
- 어필리에이트 제품 목록/등록/수정
- 플랫폼 (쿠팡/네이버/기타), 가격, 키워드 관리

### 계정 관리 (`/accounts`)
- Threads 계정 목록/등록
- 로그인 정보 (email/password, 로그인 방식)
- 자동 생성 설정 (활성화, 시간, 카테고리)
- Rate limit 현황

### 전략 설정 (`/strategy`)
- AI 시스템 프롬프트 편집
- 최적 글 길이, 해시태그 전략
- 발행 시간대, 댓글 수, 딜레이 범위

---

## 7. API 엔드포인트 정리

| 메서드 | 경로 | 설명 | 요청 바디 |
|--------|------|------|-----------|
| GET | `/api/posts` | 포스트 목록 (status/account 필터) | - |
| POST | `/api/posts` | 포스트 생성 | `{ topic, keywords, account, ... }` |
| GET | `/api/posts/[id]` | 포스트 상세 | - |
| PATCH | `/api/posts/[id]` | 포스트 수정 | `{ status?, thread?, ... }` |
| DELETE | `/api/posts/[id]` | 포스트 삭제 | - |
| GET | `/api/products` | 제품 목록 | - |
| POST | `/api/products` | 제품 생성 | `{ name, url, platform, ... }` |
| GET | `/api/products/[id]` | 제품 상세 | - |
| PATCH | `/api/products/[id]` | 제품 수정 | - |
| DELETE | `/api/products/[id]` | 제품 삭제 | - |
| GET | `/api/products/suggest` | 계정별 제품 추천 | `?accountId=xxx` |
| GET | `/api/accounts` | 계정 목록 | - |
| POST | `/api/accounts` | 계정 생성 | `{ username, loginEmail, ... }` |
| GET | `/api/accounts/[id]` | 계정 상세 | - |
| PATCH | `/api/accounts/[id]` | 계정 수정 | - |
| DELETE | `/api/accounts/[id]` | 계정 삭제 | - |
| POST | `/api/generate/hooks` | AI 후킹 생성 | `{ postId }` |
| POST | `/api/generate/draft` | AI 대본 생성 | `{ postId, replyCount? }` |
| GET | `/api/strategy` | 전략 설정 조회 | - |
| PUT | `/api/strategy` | 전략 설정 수정 | `StrategyConfig` |
| GET | `/api/scheduler` | 스케줄러 상태 | - |
| POST | `/api/scheduler` | 스케줄러 제어 | `{ action, accountId, time? }` |
| POST | `/api/scrape` | URL 스크래핑 | `{ url }` |

---

## 8. CSS 시스템

Tailwind 클래스 **사용 금지**. CSS 변수만 사용:

```css
--bg: #0F1729          /* 배경 (다크 네이비) */
--bg-card              /* 카드 배경 */
--primary: #00D4FF     /* 시안 강조색 */
--mint: #34D399        /* 그린 (성공/정상) */
--orange: #FB923C      /* 주황 (경고) */
--text: #F1F5F9        /* 기본 텍스트 */
--text-s: #94A3B8      /* 보조 텍스트 */
--border               /* 테두리 */
--surface-2            /* 2차 배경 */
```

공통 클래스: `.card`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`

---

## 9. 테스트 구조

```bash
npm run test          # 전체 테스트
npm run test:unit     # 단위 테스트
npm run test:e2e      # E2E 테스트
npm run test:e2e:tier1  # Tier 1: Pinchtab API 연동
npm run test:e2e:tier2  # Tier 2: Threads 발행 플로우
```

---

## 10. 핵심 설계 원칙

1. **DB 없음** — `readStore`/`writeStore`로 JSON 파일만 사용
2. **모든 페이지 `'use client'`** — 서버 컴포넌트 미사용
3. **API 응답 통일** — `ok(data)` / `fail(message, status, code)`
4. **프로필 격리** — Pinchtab 계정별 독립 브라우저 프로필
5. **봇 탐지 회피** — 랜덤 딜레이, rate limit, 자연스러운 조작 순서
6. **제품 균등 분배** — useCount 기반 라운드로빈
