import { Router } from "express";
import { z } from "zod";
import type { JwtService } from "../auth/jwt.js";
import { authUserId, requireAuth } from "../auth/middleware.js";
import { eventDto } from "../events/dto.js";
import type { EventService } from "../events/service.js";
import { isDateString } from "../events/time.js";
import { EVENT_TYPES } from "../events/types.js";
import { parseBody } from "../validate.js";

export const dateString = z.string().refine(isDateString, "YYYY-MM-DD 형식이어야 합니다");

const eventInput = z.object({
  category: z.string().max(50).nullable().optional(),
  title: z.string().min(1).max(200),
  start: z.string(),
  end: z.string(),
  allDay: z.boolean(),
  location: z.string().max(200).nullable().optional(),
  type: z.enum(EVENT_TYPES).nullable().optional(),
  important: z.boolean().optional(),
  isDeadline: z.boolean().nullable().optional(),
});

const eventPatch = eventInput
  .partial()
  .extend({
    completed: z.boolean().optional(),
    prepHours: z.number().min(0).max(1000).nullable().optional(),
  })
  .refine(
    (patch) => patch.allDay === undefined || (patch.start !== undefined && patch.end !== undefined),
    {
      message: "allDay를 바꿀 때는 start와 end도 함께 보내야 합니다.",
    },
  );

const rangeQuery = z
  .object({ from: dateString, to: dateString })
  .refine((query) => query.to >= query.from, { message: "to가 from보다 빠릅니다." });

export interface EventsRouterDeps {
  jwt: JwtService;
  events: EventService;
}

/** /v1/events 아래에 붙인다. */
export function eventsRouter({ jwt, events }: EventsRouterDeps): Router {
  const router = Router();
  router.use(requireAuth(jwt));

  router.get("/", async (req, res) => {
    const { from, to } = parseBody(rangeQuery, req.query);
    const rows = await events.list(authUserId(res), from, to);
    res.json(rows.map(eventDto));
  });

  router.post("/", async (req, res) => {
    const row = await events.create(authUserId(res), parseBody(eventInput, req.body));
    res.status(201).json(eventDto(row));
  });

  router.patch("/:id", async (req, res) => {
    const row = await events.update(
      authUserId(res),
      req.params.id,
      parseBody(eventPatch, req.body),
    );
    res.json(eventDto(row));
  });

  router.delete("/:id", async (req, res) => {
    await events.remove(authUserId(res), req.params.id);
    res.status(204).end();
  });

  return router;
}
