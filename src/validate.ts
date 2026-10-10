import type { z } from "zod";
import { ApiError } from "./errors.js";

/** 요청 본문을 검사한다. 틀리면 400 VALIDATION_ERROR. */
export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join(".") || "본문"}: ${issue.message}`)
      .join(", ");
    throw new ApiError(400, "VALIDATION_ERROR", detail);
  }
  return result.data;
}
