import { Router } from "express";
import { authUserId, requireAuth } from "../auth/middleware.js";
import type { JwtService } from "../auth/jwt.js";
import type { Db } from "../db.js";
import { ApiError } from "../errors.js";

export interface MeRouterDeps {
  db: Db;
  jwt: JwtService;
}

/** /v1/me 아래에 붙인다. */
export function meRouter({ db, jwt }: MeRouterDeps): Router {
  const router = Router();
  router.use(requireAuth(jwt));

  router.get("/", async (_req, res) => {
    const user = await db.user.findUnique({
      where: { id: authUserId(res) },
      include: { profile: true },
    });
    if (!user) {
      throw new ApiError(
        401,
        "UNAUTHENTICATED",
        "사용자를 찾을 수 없습니다. 다시 로그인해 주세요.",
      );
    }
    const { profile } = user;
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      // 시작 설정 전에는 null
      profile: profile && {
        activeStart: profile.activeStart,
        activeEnd: profile.activeEnd,
        restDays: profile.restDays,
        dailyCapacityHours: profile.dailyCapacityHours,
        lifeType: profile.lifeType,
      },
    });
  });

  return router;
}
