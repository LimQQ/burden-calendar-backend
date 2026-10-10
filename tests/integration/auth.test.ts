import { randomBytes } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { CALENDAR_SCOPE, type GoogleAuth } from "../../src/auth/google.js";
import { createTokenCipher } from "../../src/auth/token-cipher.js";
import { createDb } from "../../src/db.js";
import { fakeGoogleAuth, testDeps } from "../helpers.js";
import { resetDb, TEST_DATABASE_URL } from "./db.js";

const db = createDb(TEST_DATABASE_URL);
const tokenCipher = createTokenCipher(randomBytes(32));
const appWith = (googleAuth: GoogleAuth = fakeGoogleAuth()) =>
  createApp(testDeps({ db, googleAuth, tokenCipher }));

beforeEach(() => resetDb(db));
afterAll(() => db.$disconnect());

describe("POST /v1/auth/demo", () => {
  it("빈 데모 사용자를 만들고 토큰을 준다", async () => {
    const app = appWith();
    const res = await request(app).post("/v1/auth/demo");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      accessToken: expect.any(String),
      user: { id: expect.any(String), email: null, name: "데모 사용자" },
    });
    const saved = await db.user.findUniqueOrThrow({ where: { id: res.body.user.id } });
    expect(saved.isDemo).toBe(true);

    const me = await request(app)
      .get("/v1/me")
      .set("Authorization", `Bearer ${res.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body).toEqual({ id: saved.id, email: null, name: "데모 사용자", profile: null });
  });

  it("scenario는 아직 400 VALIDATION_ERROR", async () => {
    const res = await request(appWith()).post("/v1/auth/demo").send({ scenario: "busy-week" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(await db.user.count()).toBe(0);
  });
});

describe("POST /v1/auth/google", () => {
  const body = { idToken: "id-token", serverAuthCode: "auth-code" };

  it("처음 로그인하면 사용자와 암호화한 refresh token을 저장한다", async () => {
    const res = await request(appWith()).post("/v1/auth/google").send(body);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      accessToken: expect.any(String),
      user: { id: expect.any(String), email: "student@example.com", name: "김학생" },
      needsOnboarding: true,
    });
    const credential = await db.googleCredential.findUniqueOrThrow({
      where: { userId: res.body.user.id },
    });
    expect(credential.refreshTokenEnc).not.toContain("refresh-token-1");
    expect(tokenCipher.decrypt(credential.refreshTokenEnc)).toBe("refresh-token-1");
    expect(credential.scopes.split(" ")).toContain(CALENDAR_SCOPE);
  });

  it("다시 로그인하면 같은 사용자이고 refresh token과 이메일을 바꾼다", async () => {
    const first = await request(appWith()).post("/v1/auth/google").send(body);
    const second = await request(
      appWith(
        fakeGoogleAuth({
          identity: { email: "new@example.com" },
          tokens: { refreshToken: "refresh-token-2" },
        }),
      ),
    )
      .post("/v1/auth/google")
      .send(body);

    expect(second.status).toBe(200);
    expect(second.body.user).toEqual({
      id: first.body.user.id,
      email: "new@example.com",
      name: "김학생",
    });
    const credential = await db.googleCredential.findUniqueOrThrow({
      where: { userId: first.body.user.id },
    });
    expect(tokenCipher.decrypt(credential.refreshTokenEnc)).toBe("refresh-token-2");
  });

  it("refresh token 없이 다시 로그인하면 저장된 값을 그대로 둔다", async () => {
    const first = await request(appWith()).post("/v1/auth/google").send(body);
    const second = await request(appWith(fakeGoogleAuth({ tokens: { refreshToken: null } })))
      .post("/v1/auth/google")
      .send(body);

    expect(second.status).toBe(200);
    const credential = await db.googleCredential.findUniqueOrThrow({
      where: { userId: first.body.user.id },
    });
    expect(tokenCipher.decrypt(credential.refreshTokenEnc)).toBe("refresh-token-1");
  });

  it("처음 로그인인데 refresh token이 없으면 401 REAUTH_REQUIRED", async () => {
    const res = await request(appWith(fakeGoogleAuth({ tokens: { refreshToken: null } })))
      .post("/v1/auth/google")
      .send(body);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("REAUTH_REQUIRED");
    expect(await db.user.count()).toBe(0);
  });

  it("캘린더 권한이 없으면 401 REAUTH_REQUIRED", async () => {
    const res = await request(appWith(fakeGoogleAuth({ tokens: { scopes: ["openid"] } })))
      .post("/v1/auth/google")
      .send(body);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("REAUTH_REQUIRED");
  });

  it("idToken 확인에 실패하면 401 UNAUTHENTICATED", async () => {
    const res = await request(appWith(fakeGoogleAuth({ failVerify: true })))
      .post("/v1/auth/google")
      .send(body);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("인증 코드 교환에 실패하면 401 UNAUTHENTICATED", async () => {
    const res = await request(appWith(fakeGoogleAuth({ failExchange: true })))
      .post("/v1/auth/google")
      .send(body);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("GET /v1/me", () => {
  it("지워진 사용자의 토큰은 401 UNAUTHENTICATED", async () => {
    const app = appWith();
    const login = await request(app).post("/v1/auth/demo");
    await db.user.delete({ where: { id: login.body.user.id } });

    const res = await request(app)
      .get("/v1/me")
      .set("Authorization", `Bearer ${login.body.accessToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});
