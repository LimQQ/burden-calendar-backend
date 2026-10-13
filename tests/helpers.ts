import { randomBytes } from "node:crypto";
import { pino } from "pino";
import type { AppDeps } from "../src/app.js";
import {
  CALENDAR_SCOPE,
  type GoogleAuth,
  type GoogleIdentity,
  type GoogleTokens,
} from "../src/auth/google.js";
import { createJwtService } from "../src/auth/jwt.js";
import { createTokenCipher } from "../src/auth/token-cipher.js";
import { createDb } from "../src/db.js";

export const TEST_JWT_SECRET = "test-jwt-secret-0123456789abcdef0123";

/** 테스트용 의존성. db는 만들기만 하고 연결하지 않으므로 DB 없는 테스트에도 쓸 수 있다. */
export function testDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return {
    logger: pino({ level: "silent" }),
    db: overrides.db ?? createDb("postgresql://unused:unused@localhost:1/unused"),
    jwt: createJwtService(TEST_JWT_SECRET),
    googleAuth: null,
    calendarFor: null,
    tokenCipher: createTokenCipher(randomBytes(32)),
    nlpModel: null,
    ...overrides,
  };
}

export interface FakeGoogleOptions {
  identity?: Partial<GoogleIdentity>;
  tokens?: Partial<GoogleTokens>;
  failVerify?: boolean;
  failExchange?: boolean;
}

/** 구글 서버를 부르지 않는 가짜 GoogleAuth */
export function fakeGoogleAuth(options: FakeGoogleOptions = {}): GoogleAuth {
  return {
    async verifyIdToken() {
      if (options.failVerify) {
        throw new Error("invalid id token");
      }
      return {
        sub: "google-sub-1",
        email: "student@example.com",
        name: "김학생",
        ...options.identity,
      };
    },
    async exchangeCode() {
      if (options.failExchange) {
        throw new Error("invalid_grant");
      }
      return {
        refreshToken: "refresh-token-1",
        scopes: ["openid", CALENDAR_SCOPE],
        ...options.tokens,
      };
    },
  };
}
