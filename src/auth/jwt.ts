import { jwtVerify, SignJWT } from "jose";

/** 서버 JWT 유효기간: 7일. 구글 Testing 모드의 refresh token 만료(7일)와 맞췄다. */
export const ACCESS_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface JwtService {
  sign(userId: string): Promise<string>;
  /** 사용자 id를 돌려준다. 서명이 틀렸거나 만료됐으면 null. */
  verify(token: string): Promise<string | null>;
}

export function createJwtService(
  secret: string,
  ttlSeconds: number = ACCESS_TOKEN_TTL_SECONDS,
): JwtService {
  const key = new TextEncoder().encode(secret);
  return {
    async sign(userId) {
      const now = Math.floor(Date.now() / 1000);
      return new SignJWT()
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(userId)
        .setIssuedAt(now)
        .setExpirationTime(now + ttlSeconds)
        .sign(key);
    },
    async verify(token) {
      try {
        const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
        return typeof payload.sub === "string" ? payload.sub : null;
      } catch {
        return null;
      }
    },
  };
}
