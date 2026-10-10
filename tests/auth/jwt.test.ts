import { decodeJwt } from "jose";
import { describe, expect, it } from "vitest";
import { ACCESS_TOKEN_TTL_SECONDS, createJwtService } from "../../src/auth/jwt.js";
import { TEST_JWT_SECRET } from "../helpers.js";

const jwt = createJwtService(TEST_JWT_SECRET);

describe("JwtService", () => {
  it("서명한 토큰에서 사용자 id를 꺼낸다", async () => {
    expect(await jwt.verify(await jwt.sign("user-1"))).toBe("user-1");
  });

  it("유효기간은 7일", async () => {
    const { iat, exp } = decodeJwt(await jwt.sign("user-1"));
    expect(exp! - iat!).toBe(ACCESS_TOKEN_TTL_SECONDS);
    expect(ACCESS_TOKEN_TTL_SECONDS).toBe(7 * 24 * 60 * 60);
  });

  it("다른 키로 서명한 토큰은 null", async () => {
    const other = createJwtService("another-secret-0123456789abcdef0123");
    expect(await jwt.verify(await other.sign("user-1"))).toBeNull();
  });

  it("만료된 토큰은 null", async () => {
    const expired = createJwtService(TEST_JWT_SECRET, -10);
    expect(await jwt.verify(await expired.sign("user-1"))).toBeNull();
  });

  it("형식이 틀린 토큰은 null", async () => {
    expect(await jwt.verify("not-a-jwt")).toBeNull();
  });
});
