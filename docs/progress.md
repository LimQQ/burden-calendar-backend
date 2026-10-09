# 진척 상황과 할 일

마지막 갱신: 2026-10-09

작업을 마치거나 팀 결정이 생길 때마다 이 문서를 고친다. 끝난 일은 체크하고 '진행 기록'에 날짜와 함께 남긴다.

## 지금 상태
- 단계: Phase 0 코드 완료 (브랜치 `phase0/skeleton`). docker compose 실행 확인과 PR이 남음
- 코드 저장소: `C:\Users\561gu\Desktop\burden-calendar-backend`. 설계 문서(`CLAUDE.md`, `docs/`)도 여기에 둔다. GitHub는 private 저장소
- 다음 할 일: Docker Desktop을 켜고 `docker compose up --build` 확인 → GitHub에 push하고 PR. v1 문서는 프론트 팀과 따로 맞춘다
- 일정: 개발 중심 기간 11/2~12/6, User Study 12/7·12/9

## 해야 할 일

### Phase 0 전
- [ ] v1 문서를 프론트 팀과 공유하고 확인받기 (`docs/api-draft.md`의 Event 형식, 화면별 API)
- [ ] 팀에 미정 항목 묻기 (`CLAUDE.md` '미정': 배포 DB, 생활 유형, 활동 가중치, 자연어 처리 방식, 앱 이름, 공유)
- [ ] 가정값 확인받기: 중요 배율 1.3, 동기화 범위 ±3개월, 반복 일정은 그 회차만 수정
- [x] 코드 저장소 위치 정하기: 바탕화면 `burden-calendar-backend` (10/9)
- [x] Node.js LTS(24.20.0), GitHub CLI 설치 (10/9, git은 원래 있음)
- [x] Docker Desktop 설치 (10/9, Docker 29.8 / Compose 5.5)
- [x] GitHub CLI 로그인 (10/9, 계정 LimQQ)
- [x] 설계 문서(`CLAUDE.md`, `docs/`)를 코드 저장소로 옮기기 (10/9)
- [ ] Google Cloud 프로젝트와 OAuth 클라이언트 만들기 (External + Testing, 팀원을 테스트 사용자로 등록)
- [ ] `serverAuthCode`를 받는 방법을 프론트 팀과 맞추기 (Flutter `google_sign_in` 버전)

### Phase 0 저장소 뼈대
- [x] TypeScript·Express, ESLint·Prettier, Vitest (10/9)
- [x] Dockerfile, docker-compose(db → migrate → api), Prisma 설정 (10/9)
- [x] DB 스키마(api-draft 표 9개)와 첫 마이그레이션 `20261009000000_init` (10/9)
- [x] `GET /health`, 오류 응답 형식(404·400·500), `.env.example`, README (10/9)
- [x] GitHub Actions: lint + 타입 검사 + 테스트 + 빌드 (10/9)
- [ ] `docker compose up --build`로 db·migrate·api 실행 확인 (Docker Desktop 실행 필요)
- [ ] GitHub private 저장소 만들고 push, PR 올리기, 첫 CI 통과 확인

### Phase 1 구글 로그인 + 캘린더 기본 기능
- [ ] `POST /v1/auth/google`, 자체 JWT, refresh token 암호화 저장
- [ ] `POST /v1/calendar/sync` (기본 ±3개월)
- [ ] `GET`·`POST`·`PATCH`·`DELETE /v1/events`
- [ ] 제목 규칙 `[카테고리] 일정 제목`, 카테고리 API(`/v1/categories`)
- [ ] 일정 종류 분류와 마감(깃발) 판정 (분류 테스트 C1~C7)
- [ ] 완료·중요 표시

### Phase 2 부담도 엔진 + 히트맵 API
- [ ] 부담도 엔진 (순수 함수, `params.ts`) (점수 테스트 1~11)
- [ ] `GET /v1/burden/days`, `GET /v1/burden/days/:date`, 규칙 점수(`model=rule`)
- [ ] 데모 사용자(`POST /v1/auth/demo`)와 시드 데이터

### Phase 3 시작 설정 + 저녁 체크인 + 개인 보정
- [ ] `PUT /v1/me/profile`, `PUT /v1/me/weights`
- [ ] `POST`·`GET /v1/checkins`, α 보정

### Phase 4 자연어 입력
- [ ] `POST /v1/nlp/parse` (규칙 기반)
- [ ] `POST /v1/events/preview`

### Phase 5 과부하 경고, 재배치·휴식 제안 (시간이 모자라면 가장 먼저 줄임)
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

## 진행 기록
- 10/8 이전: 설계 문서 v0 작성 (CLAUDE.md, 부담도 모델, API·DB 초안, claude.ai 채팅에서)
- 10/7: 팀 앱 구상도 공유 (`지능hci 앱 구상도_261007_212200.pdf`)
- 10/8: 앱 구상도를 반영해 설계 문서를 v1로 고침. 문서를 `지능HCI/조별과제` 폴더로 모으고 이 문서를 만듦
- 10/9: 바탕화면에 코드 저장소 폴더 `burden-calendar-backend`를 만들고 설계 문서를 옮김. Node.js LTS·GitHub CLI 설치. Docker는 winget 패키지 이름을 잘못 안내해(`Docker.Docker`) 설치 실패, `Docker.DockerDesktop`으로 다시 설치해 완료. 개발 도구 준비 끝(Node 24.20, npm 11.19, Docker 29.8, gh 2.102)
- 10/9: git 시작(main에 설계 문서 첫 커밋). `phase0/skeleton` 브랜치에서 Phase 0 뼈대 작성. lint·타입 검사·테스트 6개·빌드 통과, `npm run dev`로 `/health` 응답 확인. 첫 마이그레이션은 Docker가 꺼져 있어 `prisma migrate diff`로 스키마에서 만듦
