import { Router } from "express";
import { z } from "zod";
import type { JwtService } from "../auth/jwt.js";
import { authUserId, requireAuth } from "../auth/middleware.js";
import type { Db } from "../db.js";
import { ApiError } from "../errors.js";
import { categoryDto, COLOR_PATTERN, nextCategoryColor } from "../events/categories.js";
import { parseBody } from "../validate.js";

const color = z
  .string()
  .regex(COLOR_PATTERN, "#RRGGBB 형식이어야 합니다")
  .transform((value) => value.toUpperCase());

const createBody = z.object({ name: z.string().trim().min(1).max(50), color: color.optional() });
const patchBody = z.object({ color });

export interface CategoriesRouterDeps {
  db: Db;
  jwt: JwtService;
}

/** /v1/categories 아래에 붙인다. */
export function categoriesRouter({ db, jwt }: CategoriesRouterDeps): Router {
  const router = Router();
  router.use(requireAuth(jwt));

  router.get("/", async (_req, res) => {
    const categories = await db.category.findMany({
      where: { userId: authUserId(res) },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    res.json(categories.map(categoryDto));
  });

  router.post("/", async (req, res) => {
    const userId = authUserId(res);
    const { name, color } = parseBody(createBody, req.body);
    const existing = await db.category.findUnique({ where: { userId_name: { userId, name } } });
    if (existing) {
      throw new ApiError(400, "VALIDATION_ERROR", `name: 이미 있는 카테고리입니다 (${name}).`);
    }
    const category = await db.category.create({
      data: { userId, name, color: color ?? (await nextCategoryColor(db, userId)) },
    });
    res.status(201).json(categoryDto(category));
  });

  router.patch("/:id", async (req, res) => {
    const userId = authUserId(res);
    const { color } = parseBody(patchBody, req.body);
    const { count } = await db.category.updateMany({
      where: { id: req.params.id, userId },
      data: { color },
    });
    if (count === 0) {
      throw new ApiError(404, "NOT_FOUND", "카테고리를 찾을 수 없습니다.");
    }
    res.json(categoryDto(await db.category.findUniqueOrThrow({ where: { id: req.params.id } })));
  });

  return router;
}
