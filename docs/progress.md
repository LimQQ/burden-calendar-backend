# 진척 상황과 할 일

마지막 갱신: 2026-10-25

작업을 마치거나 팀 결정이 생길 때마다 이 문서를 고친다. 끝난 일은 체크하고 '진행 기록'에 날짜와 함께 남긴다.

## 지금 상태
- 단계: Phase 0·1 완료, Phase 4의 자연어 해석(`/v1/nlp/parse`) 완료(PR #1·#2·#3 머지). 팀 중간 발표 PPT(10/25)에 맞춰 설계 문서를 v2로 고침(7단계, 노선도, Firestore)
- 코드 저장소: `C:\Users\561gu\Desktop\burden-calendar-backend` (GitHub `LimQQ/burden-calendar-backend`, 10/13부터 public). 강유준 저장소 `riverjune/burden-calendar`의 `backend/`로 옮겨 합치기로 함(10/25)
- 다음 할 일: 유준 저장소 협업자 초대 받기(LimQQ). 도구 체인을 유준과 정하기. 코드를 옮기고 DB 층을 Firestore로 다시 짜기. 그다음 Phase 2(부담도 엔진 v2, 노선도)
- 일정: 개발 중심 기간 11/2~12/6, 7일 사용 평가 11/30부터(유준 명세서 제안), 발표 12/7·12/9

## 해야 할 일

### Phase 0 전
- [ ] v1 문서를 프론트 팀과 공유하고 확인받기 (`docs/api-draft.md`의 Event 형식, 화면별 API)
- [ ] 팀에 미정 항목 묻기 (`CLAUDE.md` '미정': 배포 DB, 생활 유형, 활동 가중치, 앱 이름, 공유)
- [ ] 가정값 확인받기: 중요 배율 1.3, 동기화 범위 ±3개월, 반복 일정은 그 회차만 수정
- [x] 코드 저장소 위치 정하기: 바탕화면 `burden-calendar-backend` (10/9)
- [x] Node.js LTS(24.20.0), GitHub CLI 설치 (10/9, git은 원래 있음)
- [x] Docker Desktop 설치 (10/9, Docker 29.8 / Compose 5.5)
- [x] GitHub CLI 로그인 (10/9, 계정 LimQQ)
- [x] 설계 문서(`CLAUDE.md`, `docs/`)를 코드 저장소로 옮기기 (10/9)
- [ ] Google Cloud 프로젝트와 OAuth 클라이언트 만들기 (External + Testing, 팀원을 테스트 사용자로 등록)
- [ ] `serverAuthCode`를 받는 방법을 프론트 팀과 맞추기 (하이브리드 앱: 네이티브 플러그인 또는 시스템 브라우저)

### Phase 0 저장소 뼈대
- [x] TypeScript·Express, ESLint·Prettier, Vitest (10/9)
- [x] Dockerfile, docker-compose(db → migrate → api), Prisma 설정 (10/9)
- [x] DB 스키마(api-draft 표 9개)와 첫 마이그레이션 `20261009000000_init` (10/9)
- [x] `GET /health`, 오류 응답 형식(404·400·500), `.env.example`, README (10/9)
- [x] GitHub Actions: lint + 타입 검사 + 테스트 + 빌드 (10/9)
- [x] `docker compose up --build`로 db·migrate·api 실행 확인: 테이블 9개 생성, `/health` 응답, 스키마와 마이그레이션 차이 없음 (10/9)
- [x] GitHub private 저장소(`LimQQ/burden-calendar-backend`) 만들고 PR #1 올림, 첫 CI 통과 (10/9)
- [x] PR #1 머지 (10/10, 일반 merge)

### Phase 1 구글 로그인 + 캘린더 기본 기능
PR A 제목 규칙·종류 분류 (브랜치 `phase1/title-classify`)
- [x] 제목 규칙 `[카테고리] 일정 제목` 나누기·만들기 (10/10)
- [x] 일정 종류 분류, 마감(깃발) 판정, 기본 준비 시간. 분류 테스트 C1~C7 통과 (10/10)
- [x] 키워드·계수를 `src/burden/params.ts`로 (10/10)
- [x] PR #2로 머지 (10/10, A·B·C를 한 PR로)

PR B 로그인 (브랜치 `phase1/auth`, PR A 위에 쌓음)
- [x] 자체 JWT 발급·검사(7일), 인증 미들웨어 (10/10)
- [x] `POST /v1/auth/google`: idToken 검증, serverAuthCode 교환, refresh token AES-256-GCM 암호화 저장 (10/10, 구글 쪽은 가짜 객체로 테스트)
- [x] `POST /v1/auth/demo` (빈 데모 사용자), `GET /v1/me` (10/10)
- [x] 통합 테스트(실제 PostgreSQL, `npm run test:db`)와 CI의 PostgreSQL 서비스 (10/10)
- [ ] 실제 구글 계정으로 로그인 확인 (Google Cloud OAuth 설정과 앱의 serverAuthCode가 있어야 함)
- [x] PR #2로 머지 (10/10)

PR C 일정·카테고리 API (브랜치 `phase1/events`, PR B 위에 쌓음)
- [x] 일정 저장 방식 2가지: 구글 캘린더(실제 사용자) / DB만(데모 사용자) (10/10)
- [x] `POST /v1/calendar/sync` (기본 캘린더, 기본 ±3개월) (10/10)
- [x] `GET`·`POST`·`PATCH`·`DELETE /v1/events`, 완료·중요·깃발·준비 시간 사용자 지정 (10/10)
- [x] `GET`·`POST`·`PATCH /v1/categories` (10/10)
- [x] 사용자가 고친 준비 시간을 지키려고 `Event.prepHoursSource` 추가(마이그레이션 `20261010082410_prep_hours_source`) (10/10)
- [ ] 실제 구글 캘린더로 만들기·고치기·지우기·동기화 확인 (테스트는 가짜 구글 캘린더로 함)
- [x] PR #2로 머지 (10/10)

### 옮기기 (유준 저장소 `backend/`, Firestore)
- [ ] 유준 저장소 협업자 초대 받기 (10/23에 저장소가 404, 비공개로 바뀐 듯)
- [ ] 도구 체인 정하기 (TS 7 + 빌드 없음 + node --test 또는 TS 6 + ESLint + Vitest)
- [ ] 구글 로그인·토큰 암호화·제목 규칙·종류 분류·자연어 해석·구글 캘린더 연동 코드 옮기기
- [ ] DB 층을 Firestore로 다시 짜고, 통합 테스트를 Firestore 에뮬레이터로 바꾸기
- [ ] 일정 종류를 9개로 바꾸기 (분류 테스트 C1~C7 v2)
- [ ] 이 저장소의 `CLAUDE.md`·`docs/`를 유준 저장소 `docs/`로 옮기기

### Phase 2 부담도 엔진 + 히트맵 API + 노선도
- [ ] 부담도 엔진 v2 (순수 함수, `params.ts`, 7단계) (`docs/burden-model.md` 7절 점수 테스트 1~12, 레벨 표)
- [ ] `GET /v1/burden/days`, `GET /v1/burden/days/:date` (근거 parts, 그날 처음 보여 준 레벨 저장)
- [ ] `PATCH /v1/events/:id`의 `prepRemainingHours` (남은 준비 다시 나누기)
- [ ] `GET /v1/route` 노선도, 카테고리·일정의 `isProject`
- [ ] 수업 기능 비교용 시나리오 데이터 (데모 로그인의 `scenario`, 같은 일정·준비량)

### Phase 3 시작 설정 + 저녁 체크인 + 개인 맞춤
- [ ] `PUT /v1/me/profile` (생활 유형, 쉬는 날, 기상·취침, 활동별 부담), `GET /v1/me/weights`
- [ ] `PUT /v1/checkins/:date` (7단계), `GET /v1/checkins`, 릿지 회귀 개인 맞춤

### Phase 4 자연어 입력
- [x] `POST /v1/nlp/parse`: 규칙 파서 + LLM 어댑터(Gemini). 키가 없거나 실패하면 규칙만 (10/10, 브랜치 `phase4/nlp`)
- [ ] Gemini API 키(`GEMINI_API_KEY`)를 `.env`에 넣고 실제 문장 20~30개로 해석 확인 (직접: [Google AI Studio](https://aistudio.google.com)에서 키 만들기)
- [ ] User Study 동의서에 "자연어 입력 문장은 구글(Gemini)로 전송된다" 넣기
- [x] PR #3 머지 (10/13)
- [ ] 명칭 정리: '미팅' → '회의' 같은 사전, 카테고리를 공백 빼고 찾기 (PPT 9번 예시 "내일 오후 6시 지능 HCI 미팅 1시간" → `[지능HCI] 회의`)
- [ ] `POST /v1/events/preview` (부담 변화 미리보기, Phase 2 부담도 엔진 뒤)

### Phase 5 과부하 경고, 재배치·휴식 제안 (PPT에 없음. 시간이 모자라면 가장 먼저 뺌)
- [ ] `GET /v1/suggestions`

### 나중 (지금은 필수 아님)
- 리마인더 화면 (중요·완료·오늘·깃발 목록)
- syncToken 증분 동기화
- 반복 일정 '이후 모두'·'전체' 수정
- 카테고리 이름 바꾸기

## 팀 결정 기록

| 날짜 | 결정 | 반영한 곳 |
|---|---|---|
| 10/8 | 앱 구상도 스케치가 최종 방향. 전제는 "삼성 캘린더 기본 기능 + α" | `CLAUDE.md` 핵심 기능 |
| 10/8 | 일정 만들기·고치기·지우기를 Phase 1에 넣음 (구글 `calendar.events` 권한도 Phase 1부터) | `CLAUDE.md` 단계, `docs/api-draft.md` |
| 10/8 | 깃발 = 마감이 있는 일정, 별표 = 중요 (따로 둠) | `docs/api-draft.md` Event |
| 10/8 | 제목 규칙 `[카테고리] 일정 제목`만 Phase 1로 앞당김. 자유 문장 해석은 Phase 4 | `CLAUDE.md` 단계 |
| 10/8 | 리마인더 화면은 지금은 필수 아님 | `CLAUDE.md` 핵심 기능 |
| 10/8 | 월간 캘린더 날짜 칸은 부담도 레벨로 색칠 | `docs/burden-model.md` 목표 |
| 10/8 | 중요 일정을 부담도에 반영 (배율 1.3은 가정) | `docs/burden-model.md` 2절 |
| 10/8 | 카테고리 색은 사용자가 고름 | `docs/api-draft.md` 카테고리 |
| 10/9 | 코드 저장소는 바탕화면 `burden-calendar-backend` (구글 드라이브 밖) | 이 문서 '지금 상태' |
| 10/9 | 설계 문서(`CLAUDE.md`, `docs/`)는 코드 저장소에 둔다. 구글 드라이브 폴더에는 스케치 PDF만 남긴다 | `CLAUDE.md` |
| 10/9 | GitHub 저장소는 일단 private | - |
| 10/9 | DB 스키마 전체와 첫 마이그레이션을 Phase 0에 넣음 (DB 연결까지 확인하려고) | `prisma/schema.prisma` |
| 10/9 | TypeScript 6.0, Prisma 7.10 사용 (TS 7은 typescript-eslint 미지원, Prisma 8은 아직 출시 후보) | `CLAUDE.md` 버전 메모 |
| 10/10 | Phase 1을 PR 3개로 나눈다 (A 제목 규칙·종류 분류, B 로그인, C 일정·카테고리 API) | `CLAUDE.md` 단계 |
| 10/10 | 데모 로그인을 Phase 1로 앞당김 (빈 데모 사용자). 시드 데이터는 Phase 2 그대로 | `CLAUDE.md` 단계, `docs/api-draft.md` |
| 10/10 | 구글 동기화는 기본(primary) 캘린더만 | `CLAUDE.md` 구글 연동 주의 |
| 10/10 | 자연어 처리: 규칙 먼저, 못 풀면 LLM. LLM은 어댑터로 감싸고 지금은 Gemini 무료 등급 | `CLAUDE.md` 핵심 기능 6, `docs/api-draft.md` 자연어 입력 |
| 10/10 | 자연어 입력에서 날짜·시각을 확신할 수 없으면 비워 두고 묻는다(프로토타입처럼 오늘·23:59로 채우지 않음). 마감인데 시각만 없으면 그날 종일 마감 | `docs/api-draft.md` 자연어 입력 |
| 10/10 | 자연어 해석을 Phase 2보다 먼저 만든다(미리보기는 Phase 2 뒤) | `CLAUDE.md` 단계 |
| 10/10 | 시험 키워드에 '중간'을 더함 (예외 사전이 막으려던 경우가 실제로 생기게) | `docs/burden-model.md` 1절 |
| 10/13 | GitHub 저장소를 public으로 바꿈 (팀원 공유용, 커밋 기록에 비밀값 없음 확인) | - |
| 10/25 | 팀 중간 발표 PPT 초안을 팀 전체의 결정으로 본다. 문서와 다르면 PPT를 따르고, 만든 코드를 뒤집는 것은 먼저 묻는다 | `CLAUDE.md` 첫머리 |
| 10/25 | 부담 표시를 7단계로, 저녁 체크인도 7단계로 | `docs/burden-model.md` v2, `docs/api-draft.md` v2 |
| 10/25 | 부담도 식은 유준 명세서의 1차식 D(d) + 중요 × 1.3. 준비 시간은 만든 날부터 마감 전날까지 똑같이 나눔(PPT 7번). 개인 맞춤은 릿지 회귀 | `docs/burden-model.md` v2 |
| 10/25 | 프로젝트 마감 노선도 추가 (PPT 8번) | `CLAUDE.md` 핵심 기능 7, `docs/api-draft.md` 노선도 |
| 10/25 | DB는 Firestore, 앱은 하이브리드 (PPT 부록 A2). 백엔드는 유준 저장소로 옮겨 합침 | `CLAUDE.md` 기술 스택 |
| 10/25 | 자연어 해석은 규칙 먼저 유지. PPT 10번 'AI 항목 추출'은 'AI·규칙으로 항목 추출'로 읽음 | `CLAUDE.md` 핵심 기능 6 |
| 10/25 | 평가: 수업 참여자 기능 비교(약 40명, 기본 / 제안) + 배포 후 7일 사용. 비교용 규칙 점수(`model=rule`)는 뺌 | `CLAUDE.md` 구글 연동 주의 |
| 10/25 | 일정 종류를 시작 설정의 활동 목록과 같은 9개로 (class, study, exam, team, work, social, exercise, rest, other) | `docs/burden-model.md` v2 1절 |

## 진행 기록
- 10/8 이전: 설계 문서 v0 작성 (CLAUDE.md, 부담도 모델, API·DB 초안, claude.ai 채팅에서)
- 10/7: 팀 앱 구상도 공유 (`지능hci 앱 구상도_261007_212200.pdf`)
- 10/8: 앱 구상도를 반영해 설계 문서를 v1로 고침. 문서를 `지능HCI/조별과제` 폴더로 모으고 이 문서를 만듦
- 10/9: 바탕화면에 코드 저장소 폴더 `burden-calendar-backend`를 만들고 설계 문서를 옮김. Node.js LTS·GitHub CLI 설치. Docker는 winget 패키지 이름을 잘못 안내해(`Docker.Docker`) 설치 실패, `Docker.DockerDesktop`으로 다시 설치해 완료. 개발 도구 준비 끝(Node 24.20, npm 11.19, Docker 29.8, gh 2.102)
- 10/9: git 시작(main에 설계 문서 첫 커밋). `phase0/skeleton` 브랜치에서 Phase 0 뼈대 작성. lint·타입 검사·테스트 6개·빌드 통과, `npm run dev`로 `/health` 응답 확인. 첫 마이그레이션은 Docker가 꺼져 있어 `prisma migrate diff`로 스키마에서 만듦
- 10/9: GitHub private 저장소 `LimQQ/burden-calendar-backend` 만들고 PR #1 올림(CI 통과). `docker compose up --build`로 db·migrate·api 실행 확인. Phase 0 완료
- 10/10: PR #1 머지는 자동 모드 안전장치에 막혀 직접 머지하기로 함. Phase 1 계획 승인. PR A(제목 규칙·종류 분류) 작성, 테스트 32개 통과
- 10/10: PR B(로그인) 작성. 단위 테스트 49개, 통합 테스트 10개 통과. `npm run dev`로 데모 로그인 → `/v1/me`, 구글 설정 없을 때 503 확인. `npm audit`의 high 4건은 모두 prisma CLI(개발용) 안쪽 패키지(deepmerge-ts, 쓰지 않는 mysql2)라 그대로 둠
- 10/10: PR C(일정·카테고리 API) 작성. 단위 테스트 70개, 통합 테스트 41개 통과. `npm run dev`로 데모 사용자의 일정 만들기·조회·동기화·카테고리 확인. Prisma 7의 `migrate dev`가 Client를 다시 만들지 않아 `db:migrate` 스크립트에 `prisma generate`를 붙임
- 10/10: PR #2(Phase 1 전체)를 main 대상으로 엶. 시연 스크립트로 데모 로그인부터 일정·카테고리·오류 응답까지 실제 서버에서 보여 줌
- 10/10: 자연어 해석 `POST /v1/nlp/parse` 작성(규칙 파서 + Gemini 어댑터). 단위 테스트 101개, 통합 테스트 46개 통과. 키 없이 실제 서버에서 규칙 해석 확인. 분류 키워드에 '리포트'(과제)·'회식'(약속) 추가
- 10/10: PR #1·#2가 일반 merge로 main에 들어감. 자연어 해석을 main 대상 PR로 올림. 무료 Gemini 한도 검토: 개발·시연은 무료로 충분, User Study 이틀은 유료 등급(1천 번에 1~2달러) 권장
- 10/10: 팀원에게 보낼 정리 문서 작성 ([부담도 캘린더 백엔드 진행 정리](https://claude.ai/code/artifact/84d9712b-7aef-4037-8f67-7e9c47de8c68): 된 것, 팀 결정, API 요약, 구글 로그인 연결, 물어볼 것, 일정). PR A·B·C 브랜치를 GitHub에 올림(PR은 #1 머지 후)
- 10/11: 팀원 제안 「아침 브리핑과 입력 파이프라인 v0」(briefing-pipeline.md) 검토. 기존 결정과 부딪히는 곳(제목 양식, 시각 없을 때 처리, API, 색)을 정리해 질문함. 답은 아직 없음
- 10/13: PR #3(자연어 해석) 머지. 중간 발표용 [부담도 공식과 설명](https://claude.ai/code/artifact/2e5c6fd3-3f51-442a-906d-89d109647672) 문서 작성(v1 식 기준). 강유준 「백엔드 설계 명세서」와 비교한 공유 문서(`백엔드-설계-비교와-제안.md`, 저장소에 넣지 않음)를 만듦. GitHub 저장소를 public으로 바꿈
- 10/25: 팀 중간 발표 PPT 초안(16장) 검토. PPT를 팀 결정으로 보기로 하고, DB(Firestore로 옮기기)·체크인(7단계)·자연어(규칙 먼저 유지)를 정함. 설계 문서를 v2로 고침(`docs/burden-model.md`, `docs/api-draft.md`, `CLAUDE.md`, 이 문서). 코드는 아직 v1
