import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { fakeGoogleAuth, testDeps } from "./helpers.js";

const app = createApp(testDeps());

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
      .post("/v1/auth/demo")
      .set("Content-Type", "application/json")
      .send("{ broken");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: { code: "VALIDATION_ERROR", message: expect.any(String) },
    });
  });
});

describe("인증", () => {
  it("토큰 없이 /v1/me를 부르면 401 UNAUTHENTICATED", async () => {
    const res = await request(app).get("/v1/me");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("잘못된 토큰도 401 UNAUTHENTICATED", async () => {
    const res = await request(app).get("/v1/me").set("Authorization", "Bearer not-a-jwt");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("구글 설정이 없으면 /v1/auth/google은 503 GOOGLE_NOT_CONFIGURED", async () => {
    const res = await request(app)
      .post("/v1/auth/google")
      .send({ idToken: "a", serverAuthCode: "b" });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("GOOGLE_NOT_CONFIGURED");
  });

  it("/v1/auth/google 본문이 빠지면 400 VALIDATION_ERROR", async () => {
    const withGoogle = createApp(testDeps({ googleAuth: fakeGoogleAuth() }));
    const res = await request(withGoogle).post("/v1/auth/google").send({ idToken: "a" });

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: "VALIDATION_ERROR",
      message: expect.stringContaining("serverAuthCode"),
    });
  });
});
