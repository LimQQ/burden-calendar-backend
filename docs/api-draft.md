# API·DB 초안 v1

프론트(Flutter) 팀과 맞추기 위한 초안이다. 이 문서를 바탕으로 `docs/openapi.yaml`과 `prisma/schema.prisma`를 만든다.

## v0에서 바뀐 점 (10/8, 팀 스케치 반영)
- 일정 만들기·고치기·지우기(`POST`·`PATCH`·`DELETE /v1/events`)를 Phase 1로 옮겼다. 구글 권한도 Phase 1부터 `calendar.events`다.
- 제목 규칙을 `[카테고리] 일정 제목`으로 고정했다. 일정에 `category`가 생기고 카테고리 API·테이블을 추가했다. 프로필의 `titleTemplate`은 뺐다.
- 카테고리 색은 사용자가 고른다(`POST`·`PATCH /v1/categories`). 고르지 않으면 서버가 팔레트에서 기본색을 정한다.
- 일정에 `important`(중요 ☆), `completedAt`(완료), `deadlineSource`를 추가했다. `isDeadline`은 앱에서 깃발로 보인다. 중요 일정은 부담도에서 더 크게 센다.
- 월간 캘린더의 날짜 칸은 부담도 레벨로 색을 칠한다(`GET /v1/burden/days`).
- 오류 코드 목록과 화면별 API 표를 추가했다.
- 리마인더 화면은 지금은 필수가 아니어서 API에 넣지 않았다.

## 공통
- 기본 경로: `/v1`
- 인증: `Authorization: Bearer <서버 JWT>` (`/health`, `/v1/auth/*` 제외)
- 시각: ISO 8601, 서울 시간대 오프셋 포함 (예: `2026-10-28T13:30:00+09:00`)
- 날짜: `YYYY-MM-DD`, 하루의 경계는 Asia/Seoul
- 기간 조회(`from`, `to`): 날짜이고 양 끝을 포함한다. 그 기간과 조금이라도 겹치는 일정을 돌려준다.
- 오류: `{ "error": { "code": "REAUTH_REQUIRED", "message": "..." } }`
- 일정 종류(enum): class, exam, assignment, presentation, meeting, parttime, social, exercise, rest, other

| HTTP | code | 뜻 |
|---|---|---|
| 400 | VALIDATION_ERROR | 요청 형식이 틀림 (읽을 수 없는 JSON 포함) |
| 401 | UNAUTHENTICATED | 서버 JWT가 없거나 만료됨 |
| 401 | REAUTH_REQUIRED | 구글 refresh token이 만료됨 → 구글 재로그인 |
| 404 | NOT_FOUND | 없는 일정·카테고리 |
| 502 | GOOGLE_API_ERROR | 구글 호출 실패 (DB는 바뀌지 않음) |
| 500 | INTERNAL_ERROR | 처리하지 못한 서버 오류 |

## 엔드포인트

| Phase | 메서드·경로 | 요청 | 응답 |
|---|---|---|---|
| 0 | GET /health | - | `{ "ok": true }` |
| 1 | POST /v1/auth/google | `{ idToken, serverAuthCode }` | `{ accessToken, user: { id, email, name }, needsOnboarding }` |
| 1 | POST /v1/auth/demo | `{ scenario? }` | `{ accessToken, user }` (데모 사용자. `scenario`로 시드 데이터를 고르는 것은 Phase 2) |
| 1 | GET /v1/me | - | `{ id, email, name, profile }` |
| 1 | POST /v1/calendar/sync | `{ from?, to? }` (기본: 오늘 −3개월 ~ +3개월) | `{ fetched, upserted, deleted }` |
| 1 | GET /v1/events?from=&to= | - | `Event[]` (시작 시각 순) |
| 1 | POST /v1/events | `EventInput` | 만든 `Event` (구글 캘린더에도 생성) |
| 1 | PATCH /v1/events/:id | `EventInput`의 일부 + `{ completed?, prepHours? }` | 고친 `Event` (사용자 수정은 학습에도 사용) |
| 1 | DELETE /v1/events/:id | - | 204 (구글 캘린더에서도 삭제) |
| 1 | GET /v1/categories | - | `Category[]` |
| 1 | POST /v1/categories | `{ name, color? }` | 만든 `Category` (color가 없으면 팔레트에서 정함) |
| 1 | PATCH /v1/categories/:id | `{ color }` | 고친 `Category` (이름 바꾸기는 나중) |
| 2 | GET /v1/burden/days?from=&to=&model=burden\|rule | - | `[{ date, level, scores: { total, load, recovery }, modelVersion }]` |
| 2 | GET /v1/burden/days/:date | - | `{ date, level, scores, breakdown: [...], alpha }` |
| 3 | PUT /v1/me/profile | `{ activeStart, activeEnd, restDays, dailyCapacityHours, lifeType }` | 저장된 profile |
| 3 | PUT /v1/me/weights | `{ weights: { class: 1.0, ... } }` | 저장된 가중치 |
| 3 | POST /v1/checkins | `{ date, level }` (1~5) | `{ date, level, predictedLevel, alpha }` |
| 3 | GET /v1/checkins?from=&to= | - | `CheckIn[]` |
| 4 | POST /v1/nlp/parse | `{ text }` | `{ draft: EventInput, missingFields, confidence }` |
| 4 | POST /v1/events/preview | `{ draft: EventInput }` | `{ days: [{ date, before, after }], warnings }` |
| 5 | GET /v1/suggestions?date= | - | `[{ kind: "move" \| "rest", eventId?, to?, message }]` |

## 화면별 API (팀 스케치 기준)

| 화면 | 쓰는 API | 비고 |
|---|---|---|
| 월간 캘린더 (삼성 캘린더형) | `GET /v1/events`, `GET /v1/burden/days` | 날짜 칸 색 = 부담도 레벨. 색 구간은 `docs/burden-model.md` '목표' |
| 아래 '당일 일정' | `GET /v1/events?from=오늘&to=오늘` | |
| 아래 '일정 입력' 칸 | `POST /v1/events` | Phase 4부터 `/v1/nlp/parse` → `/v1/events/preview` → `POST /v1/events` |
| 타임라인 (오늘 기준 불러오기) | `GET /v1/events` | 과거 3개월까지. 동기화 범위 밖으로 스크롤하면 그 기간으로 `POST /v1/calendar/sync`. 깃발 = `isDeadline`, 완료 = `completedAt`. 간격 조절·축약·현재 시각 표시는 프론트 |
| 일정 상세 (쉽게 편집) | `PATCH`·`DELETE /v1/events/:id` | 중요 ☆ = `important`, 깃발 = `isDeadline`. 공유는 미정 |
| 날짜 근거 | `GET /v1/burden/days/:date` | |
| 카테고리 색 고르기 | `GET`·`POST`·`PATCH /v1/categories` | |
| 리마인더 (중요·완료·오늘·깃발) | - | 지금은 필수 아님 |

## 제목 규칙
- 구글 캘린더에 쓰는 제목은 `[카테고리] 일정 제목`이다. 카테고리가 없으면 `일정 제목`만 쓴다.
- 구글에서 읽을 때는 제목 맨 앞의 `[...]` 하나만 카테고리로 떼어 내고, 앞뒤 공백을 지운다. `[]`처럼 비어 있으면 카테고리가 없는 것으로 본다.
- 이 규칙을 따르지 않는 기존 일정(예: `중간고사 @ 공학관 101`)은 카테고리 없이 제목을 그대로 둔다.
- `POST`·`PATCH`에서 `category` 없이 `title`을 `[지능HCI] 회의`처럼 보내면, 서버가 같은 규칙으로 떼어 낸다. `category`를 따로 보내면 그 값이 우선이다.
- 처음 보는 카테고리 이름이면 카테고리를 새로 만들고 팔레트에서 색을 정한다. 사용자는 나중에 색을 바꿀 수 있다. 이름은 글자 그대로 비교한다(`지능HCI`와 `지능 HCI`는 다른 카테고리).
- 장소는 제목에 넣지 않고 구글 일정의 location 필드에 쓴다.

## 데이터 형식

### EventInput (요청)
```json
{
  "category": "지능HCI",
  "title": "회의",
  "start": "2026-10-09T15:00:00+09:00",
  "end": "2026-10-09T16:00:00+09:00",
  "allDay": false,
  "location": "도서관",
  "type": "meeting",
  "important": false,
  "isDeadline": null
}
```
- `POST`에서 필수: `title`, `start`, `end`, `allDay`. 나머지는 선택이다.
- 종일 일정은 `start`·`end`를 날짜(`YYYY-MM-DD`)로 주고, `end`는 마지막 날이다(포함). 구글의 '다음 날까지' 형식으로 바꾸는 일은 서버가 한다.
- `type`, `isDeadline`을 비우면 규칙으로 판정한다. 값을 주면 사용자 지정으로 고정한다(`typeSource`·`deadlineSource` = user).
- `PATCH`는 보낸 필드만 바꾼다. 추가로 `completed`(true면 지금 시각으로 완료, false면 완료 취소)와 `prepHours`를 받는다.

### Event (응답)
```json
{
  "id": "evt_123",
  "googleEventId": "abc123",
  "displayTitle": "[데이터베이스] 중간고사",
  "category": { "id": "cat_1", "name": "데이터베이스", "color": "#F2C94C" },
  "title": "중간고사",
  "start": "2026-10-21T15:00:00+09:00",
  "end": "2026-10-21T16:00:00+09:00",
  "allDay": false,
  "location": "공학관 101",
  "type": "exam",
  "typeSource": "rule",
  "typeConfidence": "high",
  "isDeadline": true,
  "deadlineSource": "rule",
  "important": false,
  "completedAt": null,
  "prepHours": 10,
  "pressure": 0.42
}
```
- `googleEventId`: 데모 사용자의 일정은 null이다.
- `displayTitle`: 구글 캘린더에 보이는 제목 그대로다.
- `category`: 없으면 null.
- `isDeadline`: 앱에서 깃발로 표시한다. `deadlineSource`가 `user`면 사용자가 직접 켜고 끈 것이다.
- `important`: 중요 ☆. 부담도에서 더 크게 센다(`docs/burden-model.md` 2절).
- `completedAt`: 완료한 시각. 완료하지 않았으면 null.
- `prepHours`, `pressure`: 마감 일정에만 값이 있고, 아니면 null. 완료한 마감은 `pressure`가 null이다.

### Category
```json
{ "id": "cat_1", "name": "지능HCI", "color": "#F2C94C" }
```
- `color`는 `#RRGGBB` 형식이고 사용자가 고른다. 고르지 않으면 서버가 팔레트에서 아직 안 쓴 색을 정한다.

### 자연어 파싱 예시 (Phase 4)
오늘이 2026-10-07이고 '지능HCI' 카테고리가 이미 있을 때, 요청 `{ "text": "내일 3시 지능HCI 회의 도서관에서" }` →
```json
{
  "draft": {
    "category": "지능HCI",
    "title": "회의",
    "start": "2026-10-08T15:00:00+09:00",
    "end": null,
    "allDay": false,
    "location": "도서관",
    "type": "meeting"
  },
  "missingFields": ["end"],
  "confidence": "medium"
}
```
'3시'는 활동 시간 안의 시각(15시)으로 해석한다. 해석이 둘 이상 가능하면 채우지 말고 missingFields에 넣는다.

규칙 기반 파서가 처리할 범위:
- 날짜: "10/21", "10월 21일", "오늘·내일·모레", "(다음 주) 수요일"
- 시각: "15시", "15:00", "오후 3시", "3시 반"
- 장소: "@" 뒤 또는 "~에서" 앞의 단어
- 카테고리: `[ ]` 안의 단어, 또는 사용자가 가진 카테고리 이름과 똑같은 단어
- 나머지 단어는 제목으로 쓰고, 제목 규칙(`[카테고리] 일정 제목`)에 맞춰 정리한다.

## DB 테이블 초안 (Prisma 모델 기준)

| 모델 | 주요 필드 | 비고 |
|---|---|---|
| User | id, googleSub(unique), email, name, isDemo, createdAt | 데모 사용자는 isDemo = true |
| GoogleCredential | userId(unique), refreshTokenEnc, scopes, updatedAt | refresh token은 암호화 저장 |
| Profile | userId(unique), activeStart, activeEnd, restDays(Int[]), dailyCapacityHours, lifeType | 시작 설정 |
| ActivityWeight | userId, type, weight, source(initial/learned) | (userId, type) 복합 키 |
| Category | id, userId, name, color, createdAt | (userId, name) unique |
| Event | id, userId, googleEventId(nullable), calendarId, title, categoryId(nullable), startAt, endAt, allDay, location, type, typeSource, typeConfidence, isDeadline, deadlineSource, important, completedAt, prepHours, updatedAt | (userId, googleEventId) unique. 데모 사용자 일정은 googleEventId가 null |
| CheckIn | id, userId, date, level, createdAt | (userId, date) unique |
| DailyScore | userId, date, model(burden/rule), total, load, recovery, level, breakdown(Json), modelVersion, computedAt | 계산 결과 캐시, (userId, date, model) 키. 일정이 바뀌면 영향받는 날짜를 다시 계산 |
| Calibration | userId(unique), alpha, n, updatedAt | 개인 보정 상태 |
