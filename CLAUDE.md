# 부담도 캘린더 백엔드 (앱 이름 미정)

대학생의 구글 캘린더 일정을 읽고 쓰면서 날짜별 '부담도'를 계산하고, Flutter 앱이 캘린더와 색(월간 히트맵)으로 보여 줄 수 있게 REST API로 제공하는 서버다.
경북대 지능HCI 텀프로젝트이며, 12/7·12/9 User Study에서 실제로 쓰인다.
이 저장소는 백엔드만 다룬다. 프론트(Flutter)는 이 서버의 API만 쓴다.
화면 구성은 팀 스케치(`지능hci 앱 구상도_261007_212200.pdf`, 10/7, 구글 드라이브 `경북대/3-2/지능HCI/조별과제/`에 있음)를 따른다. 전제는 "삼성 캘린더의 기본 기능 + α"이고, α는 부담도·체크인·자연어 입력이다.

## 핵심 기능 (팀 확정안)
1. 캘린더 기본 기능: 구글 캘린더 일정을 읽고, 만들고, 고치고, 지운다. 일정 원본은 구글 캘린더에 두고, 앱에만 있는 정보(완료, 중요, 마감 여부, 카테고리 색 등)는 이 서버의 DB에 둔다.
   - 제목 규칙: `[카테고리] 일정 제목` (예: `[지능HCI] 회의`). 카테고리마다 색이 있고, 사용자가 고를 수 있다. 세부 규칙은 `docs/api-draft.md`.
   - 완료 체크: 완료한 일정은 앱에서 색을 채우고 회색으로 보인다.
   - 중요(☆): 사용자가 붙이는 표시다.
   - 마감(깃발): 일반 일정이 아니라 마감이 있는 일정(시험, 과제 제출 등)에 붙는다. 규칙으로 판정하고, 사용자가 켜고 끌 수 있다.
   - 타임라인 보기: 오늘을 기준으로 한 세로 타임라인. 과거는 3개월까지, 미래는 제한 없이 본다. 일정 사이 간격 조절과 축약 표시는 프론트가 한다.
2. 부담도 계산: 일정 유형과 길이를 기본으로 연속 일정, 이른 시작·늦은 종료, 다가오는 마감, 쉬지 못한 날수, 회복을 반영한다. 중요(☆) 일정은 더 크게 세고, 완료한 마감은 완료한 날부터 빼고 센다. 세부 규칙은 `docs/burden-model.md`.
3. 시작 설정: 생활 유형, 쉬는 날, 활동 시간, 활동별 소모·충전을 받아 개인 가중치의 시작값을 정한다.
4. 저녁 체크인과 개인 보정: 하루 한 번 5단계 체감을 받아 예측과 비교한다. 기록이 적으면 시작값 근처에 머물고, 쌓이면 실제 체감을 반영한다.
5. 월간 히트맵: 월간 캘린더의 날짜 칸을 부담도 레벨에 따라 색칠한다. 전체·힘든 일·회복 3가지 보기, 날짜별 부담 근거(breakdown) 제공.
6. 자연어 입력과 후속 행동: 대충 쓴 한국어를 `[카테고리] 일정 제목` 규칙에 맞는 일정으로 정리하고, 추가 전 부담 변화를 보여 주며, 과부하 경고·재배치·휴식 제안으로 연결한다.

지금은 필수가 아닌 것: 리마인더 화면(중요·완료·오늘·깃발 목록). 필요해지면 일정 조회에 필터를 더한다.

대상 사용자: 과제·시험·팀플·아르바이트가 겹치는 대학생.

## 기술 스택
- 확정: Node.js, Docker, Google Cloud, 구글 로그인, Google Calendar API, GitHub
- 가정(팀이 바꿀 수 있음): TypeScript, Express, Prisma + PostgreSQL(로컬은 docker-compose), zod(입력 검증), Luxon(시간대), Vitest(테스트), pino(로그), googleapis·google-auth-library, 배포는 Cloud Run
- 배포 DB는 미정이다. 정해지기 전까지 DB 접근은 Prisma 계층에만 둔다.

## 명령어
- 처음 설정: `npm install` → `.env.example`을 `.env`로 복사 → `npm run db:generate`
- 개발 서버: `npm run dev` (DB가 필요하면 먼저 `docker compose up -d db`)
- 테스트: `npm test`
- 린트: `npm run lint` (자동 수정은 `npm run format`), 타입 검사: `npm run typecheck`
- DB 스키마 변경: `prisma/schema.prisma`를 고친 뒤 `npm run db:migrate` (마이그레이션 생성·적용, Client 재생성)
- 로컬 전체 실행: `docker compose up --build` (db → migrate → api)

## 버전 메모
- TypeScript는 6.0을 쓴다. 7.0은 typescript-eslint가 아직 지원하지 않는다.
- Prisma는 7.10을 쓴다. Client는 `src/generated/prisma`에 생성되고(커밋하지 않음) `../generated/prisma/client.js`에서 가져온다. DB 연결은 `@prisma/adapter-pg`, DB 주소는 `prisma.config.ts`에서 읽는다.
- npm 11은 설치 스크립트를 `package.json`의 `allowScripts`에 적힌 패키지만 실행한다. prisma·esbuild 버전을 올리면 `npm install-scripts approve`로 다시 허용한다.

## 폴더 구조 (목표)
```
src/
  app.ts, server.ts
  config/      환경변수 파싱(zod)
  auth/        구글 로그인, 자체 JWT, 데모 로그인
  google/      Calendar API 래퍼
  events/      일정 조회·생성·수정·삭제, 동기화, 제목 규칙, 종류 분류, 카테고리
  burden/      부담도 엔진 (순수 함수, I/O 없음) + params.ts
  checkins/    저녁 체크인, 개인 보정
  nlp/         자연어 일정 파싱 (규칙 기반 + 선택적 LLM 어댑터)
  routes/      HTTP 라우트
prisma/schema.prisma
docs/          burden-model.md, api-draft.md, progress.md (+ 이후 openapi.yaml)
tests/
```

## 반드시 지킬 규칙
1. 시간대: 저장은 UTC, '하루'의 경계와 표시는 Asia/Seoul로 계산한다. 종일 일정은 날짜(YYYY-MM-DD)로 다룬다.
2. 부담도 엔진(`src/burden`)은 DB·네트워크를 부르지 않는 순수 함수로 만든다. 모든 계수는 `src/burden/params.ts` 한 곳에 두고, 결과에는 근거 목록과 모델 버전을 함께 돌려준다.
3. 추측 금지: 자연어 입력에서 날짜·시간·장소를 확신할 수 없으면 채우지 말고 `missingFields`로 돌려준다.
4. 비밀값: `.env`와 OAuth 클라이언트 시크릿은 커밋하지 않는다(`.env.example`만 커밋). 토큰은 로그에 남기지 않고, refresh token은 AES-256-GCM으로 암호화해 저장한다.
5. API 형식은 `docs/api-draft.md`를 따른다. 응답 형식을 바꾸면 그 문서도 같은 커밋에서 고친다. 프론트 팀이 이 문서를 보고 개발한다.
6. 새 기능에는 테스트를 함께 쓴다. 부담도 엔진과 종류 분류는 `docs/burden-model.md`의 테스트 예시를 그대로 테스트 케이스로 쓴다.
7. 아래 '미정' 항목은 임의로 정하지 말고 먼저 질문한다.

## 구글 연동 주의
- 로그인 흐름: Flutter가 구글 로그인 후 `idToken`과 `serverAuthCode`를 `POST /v1/auth/google`로 보낸다. 서버는 idToken을 검증해 사용자를 식별하고, serverAuthCode를 교환해 refresh token을 암호화 저장한 뒤 자체 JWT를 발급한다. (serverAuthCode를 받는 방법은 Flutter `google_sign_in` 버전에 따라 다르므로 프론트 팀과 맞춘다.)
- 권한 범위: Phase 1부터 `calendar.events`(일정 읽기·쓰기). 캘린더 기본 기능에 일정 추가·수정·삭제가 들어가기 때문이다.
- OAuth 동의 화면이 External + Testing 상태이면 등록한 테스트 사용자만 로그인할 수 있고, 캘린더 범위를 받은 refresh token은 7일 뒤 만료된다. 만료되면 401과 `REAUTH_REQUIRED` 코드를 돌려 재로그인을 유도한다.
- 쓰기 순서: 구글에 먼저 쓰고, 성공하면 DB에 반영한다. 구글 호출이 실패하면 DB를 바꾸지 않고 `GOOGLE_API_ERROR`를 돌려준다.
- 구글에 쓰는 것은 제목(`[카테고리] 일정 제목`), 시작·종료, 종일 여부, 장소뿐이다. 완료·중요·마감 여부·종류·준비 시간은 DB에만 둔다.
- 일정 조회는 `events.list`에 `singleEvents=true`(반복 일정 펼침)와 기간(timeMin/timeMax)을 지정하는 방식으로 시작한다. 기본 동기화 범위는 오늘 기준 과거 3개월 ~ 미래 3개월(미래 범위는 가정)이고, 앱이 그 밖을 보려 하면 그 기간을 다시 동기화한다. 동기화한 기간 안에서 구글에 더 이상 없는 일정은 DB에서도 지운다. syncToken 증분 동기화는 나중 단계이며, 410 응답을 받으면 전체 재동기화한다.
- 반복 일정: 펼친 회차 하나를 일정 하나로 다룬다. 수정·삭제도 그 회차에만 적용한다(가정. '이후 모두'·'전체' 수정은 나중).
- User Study는 참가자의 실제 캘린더 대신 미리 만든 시드 데이터로 진행한다. 그래서 구글 로그인 없이 쓰는 데모 사용자(`POST /v1/auth/demo`)를 둔다. 데모 사용자의 일정 생성·수정·삭제는 구글 없이 DB에만 반영한다.

## 단계 (현재: Phase 0 완료, PR #1 머지 후 Phase 1)
- Phase 0 저장소 뼈대: TypeScript·Express, ESLint·Prettier, Vitest, Dockerfile, docker-compose(api + postgres), Prisma, `GET /health`, `.env.example`, GitHub Actions(lint + test), README
- Phase 1 구글 로그인 + 캘린더 기본 기능: `/v1/auth/google`, 토큰 암호화 저장, `/v1/calendar/sync`, 일정 조회·생성·수정·삭제(`/v1/events`), 제목 규칙과 카테고리, 일정 종류 분류(키워드 규칙)와 마감(깃발) 판정, 완료·중요 표시
- Phase 2 부담도 엔진 + 히트맵 API: 날짜별 점수·근거, `GET /v1/burden/days`, 데모 사용자와 시드 데이터
- Phase 3 시작 설정 + 저녁 체크인 + 개인 보정
- Phase 4 자연어 입력(규칙 기반 문장 해석) → 부담 변화 미리보기 → 일정 추가(Phase 1의 `POST /v1/events` 사용)
- Phase 5 과부하 경고, 재배치·휴식 제안
- 우선순위: User Study의 핵심은 Phase 1~3이다. 시간이 모자라면 Phase 5부터 줄인다. 개발 중심 기간은 11/2~12/6이다.

## 미정 (질문할 것)
- 배포 DB (Cloud SQL 또는 다른 관리형 DB)
- 생활 유형의 값 목록과 유형별 기본값
- 활동 종류 목록과 초기 소모·충전 가중치 (`docs/burden-model.md`의 값은 가정)
- 자연어 처리 방식: 규칙만 쓸지, 미분류 제목에만 LLM을 보조로 쓸지
- 앱 이름
- 일정 상세의 '공유'가 무엇인지 (휴대폰 공유 시트로 내용을 보내는 것이면 서버 작업이 없다)

## 작업 방식
- 큰 작업은 계획을 먼저 보여 주고 승인을 받은 뒤 구현한다.
- 진척 상황과 할 일은 `docs/progress.md`에 둔다. 작업을 마치거나 팀 결정이 생길 때마다 그 자리에서 고친다(끝난 일 체크, 진행 기록·결정 기록 추가, '마지막 갱신' 날짜).
- Phase가 끝나면 lint와 테스트를 돌리고, 바뀐 파일과 남은 일을 짧게 요약한다. 요약은 `docs/progress.md`에도 남긴다.
- main에 직접 push하지 않는다. 기능 단위 브랜치 → PR. 커밋 메시지는 한국어 한 줄 요약.
