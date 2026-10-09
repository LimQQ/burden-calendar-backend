import { pino } from "pino";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

const app = createApp({ logger: pino({ level: "silent" }) });

describe("GET /health", () => {
  it("200과 { ok: true }를 돌려준다", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe("오류 응답 형식", () => {
  it("없는 경로는 404 NOT_FOUND", async () => {
    const res = await request(app).get("/v1/nope");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: "NOT_FOUND", message: expect.any(String) },
    });
  });

  it("깨진 JSON 본문은 400 VALIDATION_ERROR", async () => {
    const res = await request(app)
      .post("/v1/events")
      .set("Content-Type", "application/json")
      .send("{ broken");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: { code: "VALIDATION_ERROR", message: expect.any(String) },
    });
  });
});
