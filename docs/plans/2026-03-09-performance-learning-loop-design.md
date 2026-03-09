# 성과 기반 학습 루프 설계

**날짜**: 2026-03-09
**상태**: 승인됨

## 목표

발행된 포스트의 성과 데이터(좋아요·댓글·리포스트)를 분석해 AI 대본 생성 프롬프트에 자동 반영. 데이터가 쌓일수록 반응 좋은 패턴을 우선 사용하는 학습 루프 구현.

## 방식: 사전 계산 인사이트 캐시

성과 수집 cron(6시간) 실행 시 분석 결과를 `data/strategy-insights.json`에 저장. 생성 시엔 이 파일만 읽어 프롬프트에 주입.

## 데이터 흐름

```
성과 수집 cron (6시간마다)
  → runPerformanceCollection(accountId)
  → computeInsights(accountId)          [신규]
  → data/strategy-insights.json 저장

후킹/대본 생성 요청
  → loadInsights(accountId)             [신규]
  → buildHookGenerationPrompt(..., insights)  [수정]
  → Layer 7 주입 (dataPoints >= 5일 때만)
```

## 점수 공식

```
score = likes×2 + replies×3 + reposts×4
```

리포스트(바이럴) > 댓글(인게이지먼트) > 좋아요 순으로 가중치.

## strategy-insights.json 스키마

```json
{
  "accountId": "string",
  "computedAt": "ISO8601",
  "dataPoints": 12,
  "topHookTypes": [
    { "type": "reverse", "avgScore": 45.2, "count": 8 }
  ],
  "topContentFormats": [
    { "format": "story", "avgScore": 42.0, "count": 6 }
  ],
  "topPosts": [
    { "score": 85, "text": "엄마가 싸구려라고...", "hookType": "reverse", "format": "story" }
  ]
}
```

## Layer 7 프롬프트 (dataPoints >= 5일 때만)

```
[Layer 7: 성과 기반 학습]
- 최고 성과 훅 타입: reverse (평균 점수 45.2, 8회)
- 최고 성과 포맷: story (평균 점수 42.0)
- 상위 포스트 예시: "엄마가 싸구려라고 말렸는데..."
→ 위 패턴을 우선 활용하되, 단조롭지 않게 변형할 것
```

## Cold Start

`dataPoints < 5`이면 Layer 7 완전 생략 → 기존 동작 유지.

## 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `lib/insights.ts` | 신규 — computeInsights / loadInsights |
| `lib/prompts.ts` | Layer 7 파라미터 추가 (선택적) |
| `lib/scheduler.ts` | runPerformanceCollection 끝에 computeInsights 호출 |
| `app/api/generate/hooks/route.ts` | insights 로드 후 프롬프트에 주입 |
| `app/api/generate/draft/route.ts` | 동일 |

## 변경 없는 파일

- `lib/types.ts` — 기존 PostPerformance 타입 그대로 사용
- `lib/ai.ts` — 변경 없음
- `data/posts.json` — 구조 변경 없음
