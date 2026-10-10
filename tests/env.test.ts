import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/config/env.js";

const required = {
  DATABASE_URL: "postgresql://burden:burden@localhost:5432/burden",
  JWT_SECRET: "x".repeat(32),
  TOKEN_ENC_KEY: Buffer.alloc(32).toString("base64"),
};

describe("loadEnv", () => {
  it("선택 값이 없으면 기본값을 쓴다", () => {
    expect(loadEnv(required)).toEqual({
      NODE_ENV: "development",
      PORT: 3000,
      LOG_LEVEL: "info",
      ...required,
    });
  });

  it("PORT 문자열을 숫자로 바꾼다", () => {
    expect(loadEnv({ ...required, PORT: "8080" }).PORT).toBe(8080);
  });

  it("빈 구글 설정은 없는 것으로 본다", () => {
    expect(loadEnv({ ...required, GOOGLE_CLIENT_ID: "" }).GOOGLE_CLIENT_ID).toBeUndefined();
  });

  it("잘못된 값이면 어떤 변수가 틀렸는지 알려 준다", () => {
    expect(() => loadEnv({ ...required, PORT: "abc" })).toThrow(/PORT/);
    expect(() => loadEnv({ ...required, LOG_LEVEL: "loud" })).toThrow(/LOG_LEVEL/);
    expect(() => loadEnv({ ...required, JWT_SECRET: "short" })).toThrow(/JWT_SECRET/);
    expect(() => loadEnv({ ...required, TOKEN_ENC_KEY: "abcd" })).toThrow(/TOKEN_ENC_KEY/);
  });

  it("필수 값이 빠지면 알려 준다", () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL.*JWT_SECRET.*TOKEN_ENC_KEY/);
  });
});
