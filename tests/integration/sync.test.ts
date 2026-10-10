import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { addMonths, dateRange, todayInSeoul } from "../../src/events/time.js";
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

const october = { from: "2026-10-01", to: "2026-10-31" };

function addExamAndAssignment() {
  const exam = ctx.google.add({
    summary: "[데이터베이스] 중간고사",
    location: "공학관 101",
    times: {
      allDay: false,
      startAt: new Date("2026-10-21T06:00:00Z"),
      endAt: new Date("2026-10-21T07:00:00Z"),
    },
  });
  const assignment = ctx.google.add({
    summary: "[과제] DB 3장",
    location: null,
    times: { allDay: true, startDate: "2026-10-23", endDate: "2026-10-23" },
  });
  return { exam, assignment };
}

async function sync(token: string, body?: object) {
  const res = await request(ctx.app).post("/v1/calendar/sync").set(bearer(token)).send(body);
  expect(res.status).toBe(200);
  return res.body;
}

async function listOctober(token: string) {
  const res = await request(ctx.app).get("/v1/events").query(october).set(bearer(token));
  return res.body as Record<string, unknown>[];
}

describe("POST /v1/calendar/sync", () => {
  it("구글 일정을 DB에 넣고 제목 규칙·종류 분류를 적용한다", async () => {
    const token = await loginGoogle(ctx.app);
    addExamAndAssignment();

    expect(await sync(token, october)).toEqual({ fetched: 2, upserted: 2, deleted: 0 });
    const events = await listOctober(token);
    expect(events).toMatchObject([
      {
        googleEventId: "g1",
        title: "중간고사",
        category: { name: "데이터베이스" },
        start: "2026-10-21T15:00:00+09:00",
        type: "exam",
        isDeadline: true,
        prepHours: 10,
      },
      {
        googleEventId: "g2",
        title: "DB 3장",
        category: { name: "과제" },
        start: "2026-10-23",
        end: "2026-10-23",
        allDay: true,
        type: "assignment",
      },
    ]);
  });

  it("다시 동기화하면 구글의 변경을 반영하고 앱에만 있는 값은 지킨다", async () => {
    const token = await loginGoogle(ctx.app);
    const { exam } = addExamAndAssignment();
    await sync(token, october);
    const [examRow] = await listOctober(token);
    await request(ctx.app)
      .patch(`/v1/events/${examRow!["id"]}`)
      .set(bearer(token))
      .send({ important: true, completed: true, prepHours: 12 });

    ctx.google.events.set(exam.googleEventId, {
      ...exam,
      summary: "[데이터베이스] 기말고사",
      location: "공학관 201",
    });
    expect(await sync(token, october)).toEqual({ fetched: 2, upserted: 2, deleted: 0 });

    const [updated] = await listOctober(token);
    expect(updated).toMatchObject({
      id: examRow!["id"],
      title: "기말고사",
      location: "공학관 201",
      important: true,
      completedAt: expect.any(String),
      prepHours: 12,
    });
  });

  it("구글에서 지운 일정은 동기화한 기간 안에서만 DB에서도 지운다", async () => {
    const token = await loginGoogle(ctx.app);
    const { assignment } = addExamAndAssignment();
    ctx.google.add({
      summary: "기말 발표",
      location: null,
      times: { allDay: true, startDate: "2026-12-01", endDate: "2026-12-01" },
    });
    await sync(token, { from: "2026-10-01", to: "2026-12-31" });

    ctx.google.events.delete(assignment.googleEventId);
    expect(await sync(token, october)).toEqual({ fetched: 1, upserted: 1, deleted: 1 });
    expect((await db.event.findMany()).map((e) => e.title).sort()).toEqual([
      "기말 발표",
      "중간고사",
    ]);
  });

  it("본문이 없으면 오늘 기준 ±3개월을 동기화한다", async () => {
    const token = await loginGoogle(ctx.app);
    await sync(token);

    const today = todayInSeoul();
    const range = dateRange(addMonths(today, -3), addMonths(today, 3));
    expect(ctx.google.lastListRange).toEqual({ timeMin: range.start, timeMax: range.end });
  });

  it("데모 사용자는 구글을 부르지 않는다", async () => {
    const token = await loginDemo(ctx.app);

    expect(await sync(token)).toEqual({ fetched: 0, upserted: 0, deleted: 0 });
    expect(ctx.google.calls).toEqual([]);
  });
});
