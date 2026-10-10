import { Router } from "express";
import { z } from "zod";
import type { JwtService } from "../auth/jwt.js";
import { authUserId, requireAuth } from "../auth/middleware.js";
import type { NlpService } from "../nlp/service.js";
import { parseBody } from "../validate.js";

const parseRequest = z.object({ text: z.string().trim().min(1).max(300) });

export interface NlpRouterDeps {
  jwt: JwtService;
  nlp: NlpService;
}

/** /v1/nlp 아래에 붙인다. 해석만 하고 저장하지 않는다(저장은 POST /v1/events). */
export function nlpRouter({ jwt, nlp }: NlpRouterDeps): Router {
  const router = Router();
  router.use(requireAuth(jwt));

  router.post("/parse", async (req, res) => {
    const { text } = parseBody(parseRequest, req.body);
    res.json(await nlp.parse(authUserId(res), text));
  });

  return router;
}
