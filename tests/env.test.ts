import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/config/env.js";

describe("loadEnv", () => {
  it("값이 없으면 기본값을 쓴다", () => {
    expect(loadEnv({})).toEqual({ NODE_ENV: "development", PORT: 3000, LOG_LEVEL: "info" });
  });

  it("PORT 문자열을 숫자로 바꾼다", () => {
    expect(loadEnv({ PORT: "8080" }).PORT).toBe(8080);
  });

  it("잘못된 값이면 어떤 변수가 틀렸는지 알려 준다", () => {
    expect(() => loadEnv({ PORT: "abc" })).toThrow(/PORT/);
    expect(() => loadEnv({ LOG_LEVEL: "loud" })).toThrow(/LOG_LEVEL/);
  });
});
