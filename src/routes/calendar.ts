import { Router } from "express";
import { z } from "zod";
import type { JwtService } from "../auth/jwt.js";
import { authUserId, requireAuth } from "../auth/middleware.js";
import { ApiError } from "../errors.js";
import type { EventService } from "../events/service.js";
import { addMonths, todayInSeoul } from "../events/time.js";
import { parseBody } from "../validate.js";
import { dateString } from "./events.js";

/** 기본 동기화 범위: 오늘 기준 ±3개월 (미래 범위는 가정) */
export const DEFAULT_SYNC_MONTHS = 3;

// 본문 없이 보내도 된다.
const syncBody = z.object({ from: dateString.optional(), to: dateString.optional() }).optional();

export interface CalendarRouterDeps {
  jwt: JwtService;
  events: EventService;
}

/** /v1/calendar 아래에 붙인다. */
export function calendarRouter({ jwt, events }: CalendarRouterDeps): Router {
  const router = Router();
  router.use(requireAuth(jwt));

  router.post("/sync", async (req, res) => {
    const body = parseBody(syncBody, req.body) ?? {};
    const today = todayInSeoul();
    const from = body.from ?? addMonths(today, -DEFAULT_SYNC_MONTHS);
    const to = body.to ?? addMonths(today, DEFAULT_SYNC_MONTHS);
    if (to < from) {
      throw new ApiError(400, "VALIDATION_ERROR", "to가 from보다 빠릅니다.");
    }
    res.json(await events.sync(authUserId(res), from, to));
  });

  return router;
}
