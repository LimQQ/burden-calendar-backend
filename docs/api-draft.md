# API·DB 초안 v2

프론트(하이브리드 앱) 팀과 맞추기 위한 초안이다. 프론트 팀은 이 문서를 보고 개발한다.
v2는 팀 중간 발표 PPT 초안(10/25)을 따른 목표 형식이다. 지금 서버 코드는 v1(PostgreSQL, 5단계, 종류 10개)이고, 강유준 저장소로 옮기면서 v2로 바꾼다. 경로 앞부분(`/v1` 또는 `/api`)은 옮길 때 유준과 맞춘다.

## v2에서 바뀐 점 (10/25, 팀 PPT 반영)
- 부담도는 7단계다. `GET /v1/burden/days`가 점수 D, 평소 대비 값 s, 레벨(1~7)을 준다. 계산은 `docs/burden-model.md` v2.
- 저녁 체크인도 7단계다(`PUT /v1/checkins/:date`). 예측 레벨과 함께 남긴다.
- 프로젝트 마감 노선도 `GET /v1/route`를 추가했다. 일정·카테고리에 '프로젝트' 표시(`isProject`)가 생겼다.
- 일정 종류가 9개로 바뀌었다: class, study, exam, team, work, social, exercise, rest, other.
- 남은 준비 시간을 고치는 `prepRemainingHours`를 추가했다(PPT 7번 '이유 보기·수정').
- 시작 설정이 바뀌었다: 활동 시간·하루 적정량 대신 기상·취침 시각(일하는 날·쉬는 날)과 활동별 부담(−2~+2)을 받는다.
- 비교용 규칙 점수(`model=rule`)와 `pressure`를 뺐다.
- DB는 Firestore다. 'DB 초안' 절을 Firestore 경로로 바꿨다.

## v1에서 바뀐 점 (10/8~10/10)
- 일정 만들기·고치기·지우기와 구글 권한 `calendar.events`를 Phase 1로 옮겼다.
- 제목 규칙을 `[카테고리] 일정 제목`으로 고정하고 카테고리 API를 추가했다. 카테고리 색은 사용자가 고른다.
- 일정에 `important`(중요 ☆), `completedAt`(완료), `deadlineSource`를 추가했다. `isDeadline`은 앱에서 깃발로 보인다.
- 데모 로그인 `POST /v1/auth/demo`, 오류 코드 `GOOGLE_NOT_CONFIGURED`(503)를 추가했다.
- 자연어 입력 `POST /v1/nlp/parse`를 만들었다(규칙 먼저, 못 풀면 LLM).

## 공통
- 기본 경로: `/v1`
- 인증: `Authorization: Bearer <서버 JWT>` (`/health`, `/v1/auth/*` 제외)
- 시각: ISO 8601, 서울 시간대 오프셋 포함 (예: `2026-10-28T13:30:00+09:00`)
- 날짜: `YYYY-MM-DD`, 하루의 경계는 Asia/Seoul
- 기간 조회(`from`, `to`): 날짜이고 양 끝을 포함한다. 그 기간과 조금이라도 겹치는 일정을 돌려준다.
- 오류: `{ "error": { "code": "REAUTH_REQUIRED", "message": "..." } }`
- 일정 종류(enum): class, study, exam, team, work, social, exercise, rest, other
- 부담 레벨·체크인 단계: 1 매우 편함, 2 편함, 3 약간 편함, 4 보통, 5 약간 힘듦, 6 힘듦, 7 매우 힘듦

| HTTP | code | 뜻 |
|---|---|---|
| 400 | VALIDATION_ERROR | 요청 형식이 틀림 (읽을 수 없는 JSON 포함) |
| 401 | UNAUTHENTICATED | 서버 JWT가 없거나 만료됨 |
| 401 | REAUTH_REQUIRED | 구글 refresh token이 만료됐거나 캘린더 권한이 없음 → 구글 재로그인 |
| 404 | NOT_FOUND | 없는 일정·카테고리 |
| 502 | GOOGLE_API_ERROR | 구글 호출 실패 (DB는 바뀌지 않음) |
| 503 | GOOGLE_NOT_CONFIGURED | 서버에 구글 OAuth 설정이 없음 (구글 로그인만 꺼지고 데모 로그인은 됨) |
| 500 | INTERNAL_ERROR | 처리하지 못한 서버 오류 |

## 인증
- 서버 JWT(`accessToken`)는 7일 동안 유효하다. 없거나 틀리거나 만료되면 401 `UNAUTHENTICATED`이고, 앱은 다시 로그인한다.
- `POST /v1/auth/google`
  - 앱은 구글 로그인에서 받은 `idToken`과 `serverAuthCode`를 보낸다. 로그인할 때 캘린더 범위 `https://www.googleapis.com/auth/calendar.events`를 함께 요청하고, `serverAuthCode`는 서버의 웹 클라이언트 ID로 받아야 한다.
  - 하이브리드 앱은 웹뷰 안에서 구글 로그인을 할 수 없다. 네이티브 플러그인이나 시스템 브라우저로 `serverAuthCode`를 받는다(방법은 프론트와 맞춘다).
  - 401 `UNAUTHENTICATED`: idToken이나 serverAuthCode를 확인하지 못함
  - 401 `REAUTH_REQUIRED`: 캘린더 권한이 없거나, 처음 로그인인데 refresh token이 오지 않음. 앱은 동의 화면을 다시 띄워(오프라인 접근을 강제해) 로그인한다.
  - `needsOnboarding`: 시작 설정(profile)을 아직 하지 않았으면 true
- `POST /v1/auth/demo`: 부를 때마다 새 데모 사용자를 만든다. `scenario`로 수업 비교 평가용 시나리오 일정을 고른다(Phase 2). 데모 사용자의 일정은 구글 없이 DB에만 저장한다.
- `GET /v1/me`: `profile`은 시작 설정 전에는 null이다.

## 엔드포인트

| Phase | 메서드·경로 | 요청 | 응답 |
|---|---|---|---|
| 0 | GET /health | - | `{ "ok": true }` |
| 1 | POST /v1/auth/google | `{ idToken, serverAuthCode }` | `{ accessToken, user: { id, email, name }, needsOnboarding }` |
| 1 | POST /v1/auth/demo | `{ scenario? }` | `{ accessToken, user }` |
| 1 | GET /v1/me | - | `{ id, email, name, profile }` |
| 1 | POST /v1/calendar/sync | `{ from?, to? }` (기본: 오늘 −3개월 ~ +3개월) | `{ fetched, upserted, deleted }` (데모 사용자는 모두 0) |
| 1 | GET /v1/events?from=&to= | - (from·to 필수) | `Event[]` (시작 시각 순) |
| 1 | POST /v1/events | `EventInput` | 201, 만든 `Event` (구글 캘린더에도 생성) |
| 1 | PATCH /v1/events/:id | `EventInput`의 일부 + `{ completed?, prepHours?, prepRemainingHours? }` | 고친 `Event` |
| 1 | DELETE /v1/events/:id | - | 204 (구글 캘린더에서도 삭제) |
| 1 | GET /v1/categories | - | `Category[]` (만든 순서) |
| 1 | POST /v1/categories | `{ name, color?, isProject? }` | 201, 만든 `Category` (color가 없으면 팔레트에서 정함, 같은 이름이면 400) |
| 1 | PATCH /v1/categories/:id | `{ color?, isProject? }` | 고친 `Category` (이름 바꾸기는 나중) |
| 2 | GET /v1/burden/days?from=&to= | - (최대 92일) | `[{ date, D, s, level, modelVersion }]` |
| 2 | GET /v1/burden/days/:date | - | `{ date, D, s, level, parts: [...], modelVersion }` |
| 2 | GET /v1/route?from=&to= | - (기본: 오늘 ~ +3개월) | 노선도 ('노선도' 참고) |
| 3 | PUT /v1/me/profile | `Profile` | 저장된 profile |
| 3 | GET /v1/me/weights | - | `{ weights, initial, n, changed: [...] }` |
| 3 | PUT /v1/checkins/:date | `{ level }` (1~7) | `{ date, level, predictedLevel, firstShownLevel, weights: { n, changed } }` |
| 3 | GET /v1/checkins?from=&to= | - | `CheckIn[]` |
| 4 | POST /v1/nlp/parse | `{ text }` (300자 이하) | `{ draft, missingFields, assumptions, confidence, source }` ('자연어 입력' 참고) |
| 4 | POST /v1/events/preview | `{ draft: EventInput }` | `{ days: [{ date, before, after }] }` (before·after는 `{ D, level }`) |
| 5 | GET /v1/suggestions?date= | - | `[{ kind: "move" \| "rest", eventId?, to?, message }]` (시간이 모자라면 뺌) |

## 화면별 API (팀 PPT 기준)

| 화면 | 쓰는 API | 비고 |
|---|---|---|
| 월간 캘린더 | `GET /v1/events`, `GET /v1/burden/days` | 날짜 칸 색 = 부담 레벨(7단계) |
| 하루 상세 (날짜를 누르면 위로 펼침) | `GET /v1/events?from=그날&to=그날`, `GET /v1/burden/days/:date` | 레벨 이름("5 약간 힘듦")과 일정 목록 |
| 부담 이유 보기·수정 | `GET /v1/burden/days/:date`, `PATCH /v1/events/:id` | 근거(parts)를 보여 주고, 남은 준비는 `prepRemainingHours`로 고침 |
| 프로젝트 마감 노선도 (오른쪽 아래 '노선') | `GET /v1/route` | 간격 그리기는 프론트, 압축 여부·일수는 서버 |
| 아래 '일정을 문장으로 입력' 칸 | `POST /v1/nlp/parse` → (`POST /v1/events/preview`) → `POST /v1/events` | 저장 전 미리보기에서 필요한 항목만 고침 |
| 일정 상세 | `PATCH`·`DELETE /v1/events/:id` | 중요 ☆ = `important`, 깃발 = `isDeadline`, 프로젝트 = `isProject` |
| 시작 설정 | `PUT /v1/me/profile` | |
| 저녁 체크인 | `PUT /v1/checkins/:date` | 하루 한 번, 7단계 |
| 카테고리 색 고르기 | `GET`·`POST`·`PATCH /v1/categories` | |

## 제목 규칙
- 구글 캘린더에 쓰는 제목은 `[카테고리] 일정 제목`이다. 카테고리가 없으면 `일정 제목`만 쓴다.
- 구글에서 읽을 때는 제목 맨 앞의 `[...]` 하나만 카테고리로 떼어 내고, 앞뒤 공백을 지운다. `[]`처럼 비어 있으면 카테고리가 없는 것으로 본다.
- 이 규칙을 따르지 않는 기존 일정(예: `중간고사 @ 공학관 101`)은 카테고리 없이 제목을 그대로 둔다.
- `POST`·`PATCH`에서 `category` 없이 `title`을 `[지능HCI] 회의`처럼 보내면, 서버가 같은 규칙으로 떼어 낸다. `category`를 따로 보내면 그 값이 우선이다.
- 처음 보는 카테고리 이름이면 카테고리를 새로 만들고 팔레트에서 색을 정한다. 사용자는 나중에 색을 바꿀 수 있다.
- 카테고리 이름은 공백을 빼고 비교한다(`지능 HCI`는 `지능HCI`와 같은 카테고리, PPT 9번 '명칭 정리'). 지금 코드는 글자 그대로 비교하므로 Phase 4에서 바꾼다.
- 장소는 제목에 넣지 않고 구글 일정의 location 필드에 쓴다.

## 데이터 형식

### EventInput (요청)
```json
{
  "category": "지능HCI",
  "title": "회의",
  "start": "2026-11-12T18:00:00+09:00",
  "end": "2026-11-12T19:00:00+09:00",
  "allDay": false,
  "location": "도서관",
  "type": "team",
  "important": false,
  "isDeadline": null,
  "isProject": null
}
```
- `POST`에서 필수: `title`, `start`, `end`, `allDay`. 나머지는 선택이다.
- 종일 일정은 `start`·`end`를 날짜(`YYYY-MM-DD`)로 주고, `end`는 마지막 날이다(포함). 구글의 '다음 날까지' 형식으로 바꾸는 일은 서버가 한다.
- 시간 있는 일정의 `start`·`end`는 시간대가 붙은 ISO 시각이어야 한다(시간대가 없으면 400). `end`가 `start`보다 빠르면 400.
- `type`, `isDeadline`을 비우면 규칙으로 판정한다. 값을 주면 사용자 지정으로 고정한다(`typeSource`·`deadlineSource` = user).
- `isProject`를 비우면 카테고리의 `isProject`를 따른다. 값을 주면 그 일정만 그 값으로 고정한다.
- `PATCH`는 보낸 필드만 바꾼다. 추가로 받는 것:
  - `completed`: true면 지금 시각으로 완료, 이미 완료면 그대로, false면 완료 취소
  - `prepHours`: 마감의 전체 준비 시간. 바꾸면 시작일부터 다시 나눈다
  - `prepRemainingHours`: 오늘부터 남은 준비 시간. 오늘부터 마감 전날까지 다시 나누고, 어제까지의 몫은 그대로 둔다(PPT 7번: 10시간 → 5시간이면 하루 2시간 → 1시간)
  - `type`·`isDeadline`·`isProject`·`prepHours`에 null을 보내면 사용자 지정을 풀고 규칙(또는 카테고리 값)으로 되돌린다.
  - `title`만 보내고 `[...]`가 없으면 카테고리는 그대로 둔다. 카테고리를 빼려면 `category: null`.
  - `allDay`를 바꿀 때는 `start`·`end`도 함께 보내야 한다.
  - 구글에 쓰는 값(제목·시간·장소)이 바뀔 때만 구글 캘린더를 고친다.

### 동기화 (`POST /v1/calendar/sync`)
- 기본(primary) 캘린더만 읽는다. 반복 일정은 회차마다 일정 하나가 된다. (유준 명세서는 모든 캘린더를 읽는다. 옮길 때 맞춘다.)
- 기간 안의 구글 일정을 DB에 넣거나 고친다. 앱에만 있는 값(완료, 중요, 프로젝트, 사용자가 정한 종류·깃발·준비 시간)은 그대로 둔다.
- 기간 안에서 구글에 더 이상 없는 일정은 DB에서도 지운다. 기간 밖의 일정은 건드리지 않는다.
- `fetched`: 구글에서 읽은 일정 수, `upserted`: DB에 넣거나 고친 수, `deleted`: 지운 수.

### Event (응답)
```json
{
  "id": "evt_123",
  "googleEventId": "abc123",
  "displayTitle": "[지능HCI] 발표",
  "category": { "id": "cat_1", "name": "지능HCI", "color": "#F2C94C", "isProject": true },
  "title": "발표",
  "start": "2026-11-16T15:00:00+09:00",
  "end": "2026-11-16T15:00:00+09:00",
  "allDay": false,
  "location": null,
  "type": "exam",
  "typeSource": "rule",
  "typeConfidence": "high",
  "isDeadline": true,
  "deadlineSource": "rule",
  "isProject": true,
  "important": false,
  "completedAt": null,
  "prepHours": 10,
  "prepRemainingHours": 8,
  "createdDate": "2026-11-11"
}
```
- `googleEventId`: 데모 사용자의 일정은 null이다.
- `displayTitle`: 구글 캘린더에 보이는 제목 그대로다.
- `category`: 없으면 null.
- `isDeadline`: 앱에서 깃발로 표시한다. `deadlineSource`가 `user`면 사용자가 직접 켜고 끈 것이다.
- `isProject`: 노선도에 나오는지. 이 일정에 지정한 값이 없으면 카테고리 값을 따른다.
- `important`: 중요 ☆. 부담도에서 1.3배로 센다(`docs/burden-model.md` 2절).
- `completedAt`: 완료한 시각. 완료하지 않았으면 null.
- `prepHours`, `prepRemainingHours`: 마감 일정에만 값이 있고, 아니면 null. `prepRemainingHours`는 오늘(서울) 기준 남은 준비 시간이다.
- `createdDate`: 일정을 만든 날(서울). 준비 몫을 나누는 시작점이다. 구글에서 가져온 일정은 구글의 created 날짜다.

### Category
```json
{ "id": "cat_1", "name": "지능HCI", "color": "#F2C94C", "isProject": true }
```
- `color`는 `#RRGGBB` 형식이고 사용자가 고른다. 고르지 않으면 서버가 팔레트에서 아직 안 쓴 색을 정한다.
- `isProject`: 켜면 이 카테고리의 마감 일정이 노선도에 나온다. 기본값 false.

### 부담도 (`GET /v1/burden/days`, `GET /v1/burden/days/:date`)
```json
{
  "date": "2026-11-11",
  "D": 4.0,
  "s": -68,
  "level": 2,
  "parts": [
    { "key": "events", "value": 1.5, "note": "수업 1시간, 팀 미팅 30분" },
    { "key": "prep", "value": 2.0, "note": "11/16 지능HCI 발표 준비 몫 2시간" },
    { "key": "noRest", "value": 0.5, "note": "마지막으로 쉰 날 이후 1일째" }
  ],
  "modelVersion": "burden-v2"
}
```
- 목록(`/days`)에는 `parts`가 없다. 날짜를 누르면 `/days/:date`로 근거를 받는다.
- `parts`의 key와 뜻은 `docs/burden-model.md` 4절. 값이 0인 항목은 빼도 된다.
- 오늘 날짜를 그날 처음 돌려줄 때, 그 레벨을 그날의 `firstShownLevel`로 남긴다(PPT 12번 '낮 예상 부담 저장').
- 일정을 만들거나 고치거나 지운 뒤에는 바뀐 날짜만 다시 받으면 된다. 준비 몫이 여러 날에 걸치므로 마감 일정은 시작일~마감일을 다시 받는다.

### 노선도 (`GET /v1/route`)
프로젝트로 지정한 마감 일정(`isProject`이고 `isDeadline`)만, 끝나지 않은 것을 마감 순서로 돌려준다.
```json
{
  "today": "2026-11-11",
  "stops": [
    { "eventId": "evt_201", "date": "2026-11-13", "displayTitle": "[설계] 과제 제출", "dday": 2 },
    { "eventId": "evt_202", "date": "2026-11-16", "displayTitle": "[지능HCI] 발표", "dday": 5 },
    { "eventId": "evt_203", "date": "2026-11-30", "displayTitle": "[지능HCI] 최종 보고서", "dday": 19 }
  ],
  "gaps": [
    { "from": "today", "to": "evt_201", "days": 2, "compressed": false },
    { "from": "evt_201", "to": "evt_202", "days": 3, "compressed": false },
    { "from": "evt_202", "to": "evt_203", "days": 14, "compressed": true }
  ]
}
```
- `gaps`: 오늘과 첫 마감, 이웃한 두 마감 사이의 날수. 짧은 간격은 프론트가 날수에 비례한 길이로 그린다.
- `compressed`: 날수가 기준(가정 7일)보다 길면 true. 프론트는 압축 기호(//)와 일수를 그린다. 기준은 `src/burden/params.ts`에 둔다.
- 같은 날 마감이 여럿이면 `days`가 0인 간격이 생긴다.

### Profile (시작 설정)
```json
{
  "lifeType": "student",
  "restDays": [0, 6],
  "holidaysOff": true,
  "wake": { "work": "07:30", "off": "09:00" },
  "sleep": { "work": "24:00", "off": "01:00" },
  "activityBurden": { "class": 1, "study": 1, "exam": 2, "team": 1, "work": 1, "social": 0, "exercise": -1, "rest": -1 }
}
```
- `lifeType`: student, office, shift, freelance (유형별 기본값은 미정)
- `restDays`: 쉬는 요일(0 = 일요일)
- `wake`·`sleep`: 일하는 날·쉬는 날의 기상·취침 시각. 자정을 넘는 취침은 `01:00`처럼 쓴다. 자연어 입력에서 오전·오후를 고를 때 기상~취침을 활동 시간으로 쓴다.
- `activityBurden`: 활동별 부담 −2~+2. 부담도 강도의 시작값이 된다(`docs/burden-model.md` 2절). other는 받지 않는다.

### CheckIn
```json
{ "date": "2026-11-11", "level": 5, "predictedLevel": 2, "firstShownLevel": 2, "answeredAt": "2026-11-11T22:31:00+09:00" }
```
- `predictedLevel`: 체크인을 받은 순간 그날 일정으로 계산한 레벨. 개인 맞춤에 쓴다.
- `firstShownLevel`: 앱이 그날 처음 보여 준 레벨. 7일 사용 평가에서 '예측과 체감의 차이'를 볼 때 쓴다. 그날 부담도를 한 번도 조회하지 않았으면 null.
- 같은 날 다시 보내면 덮어쓰고 가중치를 다시 맞춘다.
- 수업 비교 평가의 시나리오 사용자는 체크인을 받지 않는다(400).

### 자연어 입력 (`POST /v1/nlp/parse`)
해석만 하고 저장하지 않는다. 앱은 결과를 '저장 전 미리보기'로 보여 주고, 사용자가 빈 값을 채우거나 필요한 항목만 고친 뒤 `POST /v1/events`로 저장한다.

**해석 순서(10/25 다시 확인)**: 규칙 기반 파서가 먼저 푼다. 날짜·시작 시각·제목 중 하나라도 못 찾았을 때만 LLM(Gemini)에 묻고, 규칙이 못 찾은 칸만 채운다. 제목과 종류는 LLM 값을 쓴다. 서버에 LLM 설정이 없거나 LLM이 실패하면(시간 초과 8초 포함) 규칙 결과를 그대로 돌려준다. PPT 10번의 'AI 항목 추출'은 'AI·규칙으로 항목 추출'을 뜻한다.

**확신 없는 값은 채우지 않는다**(CLAUDE.md 규칙 3). 날짜가 없으면 `date`를 비우고, 오전·오후가 둘 다 가능한 '9시'는 `startTime`을 비운다. 단 마감인데 시각만 없으면 그날 종일 마감으로 둔다(날짜는 확실하므로).

**명칭 정리(PPT 9번, Phase 4에서 추가)**: 같은 활동을 다르게 쓴 말을 한 이름으로 맞춘다. 예: '미팅' → '회의'. 사전은 `src/burden/params.ts`에 둔다. 카테고리는 공백을 빼고 찾는다(`지능 HCI` → `지능HCI`). 지금 코드는 아직 하지 않는다.

기준 날짜가 2026-11-11(수)이고 '지능HCI' 카테고리가 이미 있을 때, 요청 `{ "text": "내일 오후 6시 지능 HCI 미팅 1시간" }` → (명칭 정리를 넣은 뒤의 목표)
```json
{
  "draft": {
    "category": "지능HCI",
    "title": "회의",
    "date": "2026-11-12",
    "startTime": "18:00",
    "endTime": "19:00",
    "allDay": false,
    "start": "2026-11-12T18:00:00+09:00",
    "end": "2026-11-12T19:00:00+09:00",
    "location": null,
    "type": "team",
    "isDeadline": false,
    "prepHours": null
  },
  "missingFields": [],
  "assumptions": [],
  "confidence": "high",
  "source": "rule"
}
```
- `date`·`startTime`·`endTime`: 미리보기의 날짜·시각 칸에 채울 값(모르면 null). `start`·`end`는 다 정해졌을 때만 채운 `POST /v1/events` 형식이다(종일이면 날짜). 끝 시각이 시작보다 이르면 다음 날로 본다.
- `missingFields`: 비어 있는 칸. `title`, `date`, `startTime`, `endTime` 중에서 나온다. 시각이 하나뿐인 마감(예: 시험)은 시작 = 종료라 `endTime`이 비지 않는다.
- `assumptions`: 짐작한 것. 미리보기에 보여 준다(예: "3시 → 오후 3시로 봄").
- `confidence`: 빈 칸·짐작이 없으면 `high`, 끝 시각만 비었거나 짐작이 있으면 `medium`, 날짜·시작 시각·제목이 비면 `low`.
- `source`: 규칙만 썼으면 `rule`, LLM이 채운 값이 있으면 `llm`.
- 저장할 때: `category`, `title`, `start`, `end`, `allDay`, `location`을 보낸다. `isDeadline`이 true면 그대로 보낸다('까지'로 판정한 마감은 제목 규칙만으로는 다시 나오지 않는다). `type`은 사용자가 바꿨을 때만 보낸다.

규칙 기반 파서가 처리할 범위:
- 날짜: "2026-11-02", "10/21", "10월 21일", "오늘·내일·모레·글피", "(이번 주·다음 주·담주·다다음 주) 수요일", "수요일"(오늘과 같은 요일이면 오늘로 보고 짐작으로 남김). 반년 넘게 지난 월·일은 내년으로 본다. '다음 달 첫째 주 금요일'처럼 달 기준 표현은 규칙이 풀지 않는다(LLM 몫)
- 시각: "15시", "15:00", "오후·저녁·밤·오전·아침·낮·새벽 3시", "3시 반", "3시 20분", 범위 "3시~5시"·"3시부터 5시까지"(끝은 앞의 오전·오후를 따름), "3시부터 2시간", "6시 1시간"
- 오전·오후가 없는 1~12시: 활동 시간(기상~취침) 안에 드는 쪽 하나면 그 시각으로 보고 짐작으로 남긴다. 둘 다 들거나 둘 다 안 들면 비운다
- 종일: "종일", "하루 종일"
- 마감: '까지'가 남아 있거나, 제목에 '마감'·'제출'이 있거나, 시험·발표
- 장소: "@" 뒤 또는 "~에서" 앞의 단어
- 카테고리: `[ ]` 안의 단어, 또는 사용자가 가진 카테고리 이름(긴 것부터)
- 나머지 단어는 제목으로 쓴다(조사 '에', '에서', '까지', '부터' 등은 뺀다).

## DB 초안 (Firestore)
모든 데이터는 사용자 문서 아래에 둔다(유준 명세서와 같은 구조). 서버만 읽고 쓰며, 앱의 직접 접근은 보안 규칙으로 막는다. 시각은 Timestamp(UTC)로 저장한다.

| 경로 | 담는 것 | 비고 |
|---|---|---|
| users/{uid} | 이름, 이메일, isDemo, profile(시작 설정), 구글 동기화 상태, 기준점(burdenRef), 가중치(weights: θ̂, n, fittedAt) | uid는 구글 계정의 sub. 데모 사용자는 서버가 만든 id |
| users/{uid}/secrets/google | 암호화한 구글 refresh token, scopes | API 응답에 넣지 않음 |
| users/{uid}/categories/{categoryId} | name, color, isProject, createdAt | name은 공백을 뺀 값으로도 찾음 |
| users/{uid}/events/{eventId} | googleEventId, title, categoryId, startAt, endAt, allDay, location, type, typeSource, typeConfidence, isDeadline, deadlineSource, isProject(null이면 카테고리 값), important, completedAt, prepHours, prepHoursSource, prepEdits([{ date, remainingHours }]), createdDate, updatedAt | startAt으로 범위 질의 |
| users/{uid}/checkins/{date} | level, predictedLevel, firstShownLevel, answeredAt | 문서 id가 날짜 |
| users/{uid}/days/{date} | firstShownLevel, firstShownAt | 그날 처음 보여 준 레벨 |
| users/{uid}/usage/{date} | 자연어 해석 횟수 | 하루 한도 확인(유준 명세서) |
