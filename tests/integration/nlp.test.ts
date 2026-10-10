import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { addDays, todayInSeoul } from "../../src/events/time.js";
import type { NlpModel } from "../../src/nlp/llm.js";
import { bearer, createTestContext, db, loginDemo } from "./context.js";
import { resetDb } from "./db.js";

beforeEach(() => resetDb(db));
afterAll(() => db.$disconnect());

/** 정해 둔 답을 돌려주는 가짜 LLM. 몇 번 불렸는지 센다. */
function fakeModel(answer: unknown | (() => never)) {
  const calls: string[] = [];
  const model: NlpModel = {
    async parse(text) {
      calls.push(text);
      return typeof answer === "function" ? (answer as () => never)() : answer;
    },
  };
  return { model, calls };
}

const llmAnswer = {
  title: "회식",
  category: "동아리",
  date: "2026-11-06",
  startTime: "19:00",
  endTime: "21:00",
  location: "",
  allDay: false,
  isDeadline: false,
  type: "social",
  missingFields: [],
  assumptions: ["다음 달 첫째 주 금요일을 11월 6일로 봄"],
};

async function setup(model?: NlpModel) {
  const ctx = createTestContext(model ? { nlpModel: model } : {});
  const token = await loginDemo(ctx.app);
  await request(ctx.app).post("/v1/categories").set(bearer(token)).send({ name: "지능HCI" });
  const parse = (text: string) =>
    request(ctx.app).post("/v1/nlp/parse").set(bearer(token)).send({ text });
  return { ...ctx, token, parse };
}

describe("POST /v1/nlp/parse", () => {
  it("규칙만으로 해석하고, 내 카테고리 이름을 알아본다", async () => {
    const { parse } = await setup();
    const res = await parse("내일 3시 지능HCI 회의 도서관에서");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      draft: {
        category: "지능HCI",
        title: "회의",
        date: addDays(todayInSeoul(), 1),
        startTime: "15:00",
        location: "도서관",
        type: "meeting",
      },
      missingFields: ["endTime"],
      source: "rule",
    });
  });

  it("규칙으로 다 풀리면 LLM을 부르지 않는다", async () => {
    const fake = fakeModel(llmAnswer);
    const { parse } = await setup(fake.model);

    expect((await parse("내일 3시 지능HCI 회의")).body.source).toBe("rule");
    expect(fake.calls).toEqual([]);
  });

  it("규칙이 날짜를 못 찾으면 LLM이 채운다", async () => {
    const fake = fakeModel(llmAnswer);
    const { parse } = await setup(fake.model);
    const res = await parse("다음 달 첫째 주 금요일 저녁 7시 동아리 회식");

    expect(fake.calls).toHaveLength(1);
    expect(res.body).toMatchObject({
      draft: {
        title: "회식",
        category: "동아리",
        date: "2026-11-06",
        startTime: "19:00",
        endTime: "21:00",
        start: "2026-11-06T19:00:00+09:00",
        end: "2026-11-06T21:00:00+09:00",
        type: "social",
      },
      missingFields: [],
      assumptions: ["다음 달 첫째 주 금요일을 11월 6일로 봄"],
      source: "llm",
    });
  });

  it("LLM이 실패하거나 엉뚱한 답을 주면 규칙 결과를 돌려준다", async () => {
    for (const answer of [
      () => {
        throw new Error("timeout");
      },
      { nope: true },
    ]) {
      const { parse } = await setup(fakeModel(answer).model);
      const res = await parse("다음 달 회식");

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ source: "rule", missingFields: ["date", "startTime"] });
      await resetDb(db);
    }
  });

  it("빈 문장은 400, 토큰 없이는 401", async () => {
    const { app, parse } = await setup();

    expect((await parse("  ")).status).toBe(400);
    expect((await request(app).post("/v1/nlp/parse").send({ text: "회의" })).status).toBe(401);
  });
});
