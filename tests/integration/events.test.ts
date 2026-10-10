import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  bearer,
  createTestContext,
  db,
  loginDemo,
  loginGoogle,
  type TestContext,
} from "./context.js";
import { resetDb } from "./db.js";

let ctx: TestContext;

beforeEach(async () => {
  await resetDb(db);
  ctx = createTestContext();
});
afterAll(() => db.$disconnect());

const meeting = {
  title: "[지능HCI] 회의",
  start: "2026-10-21T15:00:00+09:00",
  end: "2026-10-21T16:00:00+09:00",
  allDay: false,
  location: "도서관",
};

async function createEvent(token: string, body: object) {
  const res = await request(ctx.app).post("/v1/events").set(bearer(token)).send(body);
  expect(res.status).toBe(201);
  return res.body;
}

async function listEvents(token: string, from: string, to: string) {
  const res = await request(ctx.app).get("/v1/events").query({ from, to }).set(bearer(token));
  expect(res.status).toBe(200);
  return res.body as { id: string; title: string }[];
}

describe("일정 만들기·조회 (데모 사용자)", () => {
  it("시간 있는 일정: 제목 규칙으로 카테고리를 떼고 종류를 분류한다", async () => {
    const token = await loginDemo(ctx.app);
    const event = await createEvent(token, meeting);

    expect(event).toEqual({
      id: expect.any(String),
      googleEventId: null,
      displayTitle: "[지능HCI] 회의",
      category: { id: expect.any(String), name: "지능HCI", color: "#F2C94C" },
      title: "회의",
      start: "2026-10-21T15:00:00+09:00",
      end: "2026-10-21T16:00:00+09:00",
      allDay: false,
      location: "도서관",
      type: "meeting",
      typeSource: "rule",
      typeConfidence: "high",
      isDeadline: false,
      deadlineSource: "rule",
      important: false,
      completedAt: null,
      prepHours: null,
      pressure: null,
    });
    expect(await listEvents(token, "2026-10-21", "2026-10-21")).toHaveLength(1);
    expect(await listEvents(token, "2026-10-22", "2026-10-30")).toHaveLength(0);
    expect(ctx.google.calls).toEqual([]);
  });

  it("종일 일정은 날짜로 주고받고 끝 날짜를 포함한다", async () => {
    const token = await loginDemo(ctx.app);
    const event = await createEvent(token, {
      title: "[DB] 과제 제출",
      start: "2026-10-23",
      end: "2026-10-24",
      allDay: true,
    });

    expect(event).toMatchObject({
      start: "2026-10-23",
      end: "2026-10-24",
      allDay: true,
      type: "assignment",
      isDeadline: true,
      prepHours: 2,
    });
    const stored = await db.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(stored.startAt).toEqual(new Date("2026-10-22T15:00:00Z"));
    expect(stored.endAt).toEqual(new Date("2026-10-24T15:00:00Z"));

    expect(await listEvents(token, "2026-10-22", "2026-10-22")).toHaveLength(0);
    expect(await listEvents(token, "2026-10-24", "2026-10-24")).toHaveLength(1);
    expect(await listEvents(token, "2026-10-25", "2026-10-25")).toHaveLength(0);
  });

  it("category를 따로 보내면 그 값이 우선이고, 같은 이름의 카테고리는 다시 쓴다", async () => {
    const token = await loginDemo(ctx.app);
    const first = await createEvent(token, { ...meeting, category: "알바", title: "카페" });
    const second = await createEvent(token, { ...meeting, title: "[알바] 마감 정리" });

    expect(first).toMatchObject({ displayTitle: "[알바] 카페", type: "parttime" });
    expect(second.category.id).toBe(first.category.id);
    expect(await db.category.count()).toBe(1);
  });

  it("기간 조회는 시작 시각 순서", async () => {
    const token = await loginDemo(ctx.app);
    await createEvent(token, {
      ...meeting,
      title: "늦은 일정",
      start: "2026-10-21T20:00:00+09:00",
      end: "2026-10-21T21:00:00+09:00",
    });
    await createEvent(token, {
      ...meeting,
      title: "이른 일정",
      start: "2026-10-21T09:00:00+09:00",
      end: "2026-10-21T10:00:00+09:00",
    });

    const titles = (await listEvents(token, "2026-10-21", "2026-10-21")).map((e) => e.title);
    expect(titles).toEqual(["이른 일정", "늦은 일정"]);
  });

  it.each([
    ["시간대 없는 시각", { ...meeting, start: "2026-10-21T15:00:00" }],
    ["끝이 시작보다 빠름", { ...meeting, end: "2026-10-21T14:00:00+09:00" }],
    ["종일인데 시각", { ...meeting, allDay: true }],
    ["카테고리만 있고 제목이 비어 있음", { ...meeting, title: "[지능HCI]" }],
    ["모르는 종류", { ...meeting, type: "party" }],
  ])("잘못된 입력은 400: %s", async (_name, body) => {
    const token = await loginDemo(ctx.app);
    const res = await request(ctx.app).post("/v1/events").set(bearer(token)).send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("기간 조회에 from·to가 없으면 400", async () => {
    const token = await loginDemo(ctx.app);
    const res = await request(ctx.app).get("/v1/events").set(bearer(token));

    expect(res.status).toBe(400);
  });
});

describe("일정 고치기·지우기 (데모 사용자)", () => {
  it("제목을 바꾸면 다시 분류하고, 괄호가 없으면 카테고리는 그대로 둔다", async () => {
    const token = await loginDemo(ctx.app);
    const event = await createEvent(token, meeting);

    const res = await request(ctx.app)
      .patch(`/v1/events/${event.id}`)
      .set(bearer(token))
      .send({ title: "중간발표 준비" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      displayTitle: "[지능HCI] 중간발표 준비",
      type: "presentation",
      typeSource: "rule",
    });
  });

  it("사용자가 정한 종류는 제목을 바꿔도 유지되고, null을 보내면 규칙으로 돌아간다", async () => {
    const token = await loginDemo(ctx.app);
    const event = await createEvent(token, meeting);
    const patch = (body: object) =>
      request(ctx.app).patch(`/v1/events/${event.id}`).set(bearer(token)).send(body);

    expect((await patch({ type: "rest" })).body).toMatchObject({
      type: "rest",
      typeSource: "user",
    });
    expect((await patch({ title: "팀 회의" })).body).toMatchObject({
      type: "rest",
      typeSource: "user",
    });
    expect((await patch({ type: null })).body).toMatchObject({
      type: "meeting",
      typeSource: "rule",
    });
  });

  it("완료·중요·깃발·준비 시간", async () => {
    const token = await loginDemo(ctx.app);
    const event = await createEvent(token, meeting);
    const patch = (body: object) =>
      request(ctx.app).patch(`/v1/events/${event.id}`).set(bearer(token)).send(body);

    const done = (await patch({ completed: true, important: true })).body;
    expect(done.completedAt).toMatch(/\+09:00$/);
    expect(done.important).toBe(true);
    expect((await patch({ completed: true })).body.completedAt).toBe(done.completedAt);
    expect((await patch({ completed: false })).body.completedAt).toBeNull();

    // 회의는 기본 준비 시간이 없어서 깃발만 켜면 준비 시간이 비어 있다(사용자에게 묻는다).
    expect((await patch({ isDeadline: true })).body).toMatchObject({
      isDeadline: true,
      deadlineSource: "user",
      prepHours: null,
    });
    expect((await patch({ prepHours: 3 })).body.prepHours).toBe(3);
    expect((await patch({ title: "자료 회의" })).body.prepHours).toBe(3);
  });

  it("시간을 바꾼다. 종일로 바꿀 때는 start·end를 함께 보내야 한다", async () => {
    const token = await loginDemo(ctx.app);
    const event = await createEvent(token, meeting);
    const patch = (body: object) =>
      request(ctx.app).patch(`/v1/events/${event.id}`).set(bearer(token)).send(body);

    expect((await patch({ end: "2026-10-21T17:30:00+09:00" })).body.end).toBe(
      "2026-10-21T17:30:00+09:00",
    );
    expect((await patch({ allDay: true })).status).toBe(400);
    expect(
      (await patch({ allDay: true, start: "2026-10-22", end: "2026-10-22" })).body,
    ).toMatchObject({
      allDay: true,
      start: "2026-10-22",
      end: "2026-10-22",
    });
  });

  it("지우면 204, 다시 지우면 404", async () => {
    const token = await loginDemo(ctx.app);
    const event = await createEvent(token, meeting);

    expect(
      (await request(ctx.app).delete(`/v1/events/${event.id}`).set(bearer(token))).status,
    ).toBe(204);
    expect(await listEvents(token, "2026-10-21", "2026-10-21")).toHaveLength(0);
    expect(
      (await request(ctx.app).delete(`/v1/events/${event.id}`).set(bearer(token))).status,
    ).toBe(404);
  });

  it("다른 사용자의 일정은 404", async () => {
    const owner = await loginDemo(ctx.app);
    const other = await loginDemo(ctx.app);
    const event = await createEvent(owner, meeting);

    const res = await request(ctx.app)
      .patch(`/v1/events/${event.id}`)
      .set(bearer(other))
      .send({ important: true });
    expect(res.status).toBe(404);
    expect(await listEvents(other, "2026-10-21", "2026-10-21")).toHaveLength(0);
  });
});

describe("구글 사용자", () => {
  it("구글에 먼저 만들고 googleEventId를 저장한다", async () => {
    const token = await loginGoogle(ctx.app);
    const event = await createEvent(token, meeting);

    expect(event.googleEventId).toBe("g1");
    expect(ctx.google.events.get("g1")).toMatchObject({
      summary: "[지능HCI] 회의",
      location: "도서관",
    });
    // 저장해 둔 refresh token을 풀어서 썼다.
    expect(ctx.google.refreshTokens).toEqual(["refresh-token-1"]);
  });

  it("구글에 쓰는 값이 바뀔 때만 구글을 고친다", async () => {
    const token = await loginGoogle(ctx.app);
    const event = await createEvent(token, meeting);
    const patch = (body: object) =>
      request(ctx.app).patch(`/v1/events/${event.id}`).set(bearer(token)).send(body);

    await patch({ important: true, completed: true });
    expect(ctx.google.calls).toEqual(["insert"]);

    await patch({ title: "[지능HCI] 중간발표", location: null });
    expect(ctx.google.calls).toEqual(["insert", "patch"]);
    expect(ctx.google.events.get("g1")).toMatchObject({
      summary: "[지능HCI] 중간발표",
      location: null,
    });
  });

  it("지우면 구글에서도 지운다", async () => {
    const token = await loginGoogle(ctx.app);
    const event = await createEvent(token, meeting);

    await request(ctx.app).delete(`/v1/events/${event.id}`).set(bearer(token));
    expect(ctx.google.events.size).toBe(0);
  });

  it("구글 호출이 실패하면 502이고 DB는 그대로", async () => {
    const token = await loginGoogle(ctx.app);
    ctx.google.failWith = "api";

    const res = await request(ctx.app).post("/v1/events").set(bearer(token)).send(meeting);
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("GOOGLE_API_ERROR");
    expect(await db.event.count()).toBe(0);
  });

  it("구글 권한이 만료됐으면 401 REAUTH_REQUIRED", async () => {
    const token = await loginGoogle(ctx.app);
    ctx.google.failWith = "reauth";

    const res = await request(ctx.app).post("/v1/events").set(bearer(token)).send(meeting);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("REAUTH_REQUIRED");
  });

  it("서버에 구글 연동 설정이 없으면 503", async () => {
    ctx = createTestContext({ calendarConfigured: false });
    const token = await loginGoogle(ctx.app);

    const res = await request(ctx.app).post("/v1/events").set(bearer(token)).send(meeting);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("GOOGLE_NOT_CONFIGURED");
  });
});
