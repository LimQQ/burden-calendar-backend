# 부담도 캘린더 백엔드

> **이 저장소는 더 이상 개발하지 않는다(10/25).** 코드는 [riverjune/burden-calendar](https://github.com/riverjune/burden-calendar)의 `backend/`로 옮겨 합쳤다. API 문서는 그 저장소의 [`docs/api.md`](https://github.com/riverjune/burden-calendar/blob/main/docs/api.md)를 본다.

경북대 지능HCI 텀프로젝트의 백엔드 서버다. 구글 캘린더 일정으로 날짜별 부담도를 계산해 하이브리드 앱에 REST API로 제공한다. 설계는 팀 중간 발표 PPT(10/25)를 따른 v2이고, 코드는 아직 v1이다(강유준 저장소로 옮기며 v2로 바꾼다).

- 프로젝트 규칙: [CLAUDE.md](CLAUDE.md)
- API·DB 초안 (프론트 팀은 이 문서를 본다): [docs/api-draft.md](docs/api-draft.md)
- 부담도 모델: [docs/burden-model.md](docs/burden-model.md)
- 진척 상황과 할 일: [docs/progress.md](docs/progress.md)

## 필요한 도구
- Node.js 24 이상
- Docker Desktop (로컬 PostgreSQL과 전체 실행용)

## 처음 설정
```bash
npm install
cp .env.example .env
npm run db:generate
```
`.env`의 `JWT_SECRET`과 `TOKEN_ENC_KEY`에는 아래 명령으로 만든 값을 하나씩 넣는다. 구글 로그인을 쓰려면 `GOOGLE_CLIENT_ID`·`GOOGLE_CLIENT_SECRET`도 넣는다(비워 두면 데모 로그인만 된다). 자연어 입력에서 LLM(Gemini)을 쓰려면 `GEMINI_API_KEY`를 넣는다(비워 두면 규칙만으로 해석한다).
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 개발
```bash
docker compose up -d db   # PostgreSQL만 띄운다
npm run db:migrate        # 스키마를 DB에 반영한다 (스키마를 바꿨을 때도)
npm run dev               # http://localhost:3000/health
```

## 검사
```bash
npm run lint        # ESLint + Prettier 검사 (자동 수정은 npm run format)
npm run typecheck
npm test            # 단위 테스트
npm run test:db     # 통합 테스트 (docker compose up -d db 먼저, burden_test DB를 따로 쓴다)
```

## Docker로 전체 실행
```bash
docker compose up --build
```
db → migrate(마이그레이션 적용) → api 순서로 뜬다. 끝나면 http://localhost:3000/health 에서 `{"ok":true}`가 보인다.

## 브랜치 규칙
main에 직접 push하지 않는다. 기능 단위 브랜치를 만들고 PR을 올린다. 커밋 메시지는 한국어 한 줄 요약이다. PR마다 GitHub Actions가 lint·타입 검사·테스트·빌드를 돌린다.
