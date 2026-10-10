import { randomBytes } from "node:crypto";
import type { Express } from "express";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createTokenCipher } from "../../src/auth/token-cipher.js";
import { createDb } from "../../src/db.js";
import { FakeGoogleCalendar } from "../fake-google-calendar.js";
import { fakeGoogleAuth, testDeps } from "../helpers.js";
import { TEST_DATABASE_URL } from "./db.js";

export const db = createDb(TEST_DATABASE_URL);
export const tokenCipher = createTokenCipher(randomBytes(32));

export interface TestContext {
  app: Express;
  google: FakeGoogleCalendar;
}

/** 가짜 구글 로그인과 가짜 구글 캘린더를 붙인 앱 */
export function createTestContext(options: { calendarConfigured?: boolean } = {}): TestContext {
  const google = new FakeGoogleCalendar();
  const app = createApp(
    testDeps({
      db,
      tokenCipher,
      googleAuth: fakeGoogleAuth(),
      calendarFor: options.calendarConfigured === false ? null : google.factory,
    }),
  );
  return { app, google };
}

export async function loginDemo(app: Express): Promise<string> {
  const res = await request(app).post("/v1/auth/demo");
  return res.body.accessToken as string;
}

export async function loginGoogle(app: Express): Promise<string> {
  const res = await request(app)
    .post("/v1/auth/google")
    .send({ idToken: "id-token", serverAuthCode: "auth-code" });
  return res.body.accessToken as string;
}

export function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
