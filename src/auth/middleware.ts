import type { RequestHandler, Response } from "express";
import { ApiError } from "../errors.js";
import type { JwtService } from "./jwt.js";

/** `Authorization: Bearer <서버 JWT>`를 확인하고 사용자 id를 res.locals에 둔다. */
export function requireAuth(jwt: JwtService): RequestHandler {
  return async (req, res, next) => {
    const header = req.get("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;
    const userId = token ? await jwt.verify(token) : null;
    if (!userId) {
      throw new ApiError(401, "UNAUTHENTICATED", "로그인이 필요합니다.");
    }
    res.locals["userId"] = userId;
    next();
  };
}

/** requireAuth를 거친 요청의 사용자 id */
export function authUserId(res: Response): string {
  const userId: unknown = res.locals["userId"];
  if (typeof userId !== "string") {
    throw new Error("requireAuth를 거치지 않은 요청입니다.");
  }
  return userId;
}
