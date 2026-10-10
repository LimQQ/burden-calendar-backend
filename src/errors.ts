import type { ErrorRequestHandler, RequestHandler } from "express";

/** docs/api-draft.md '공통'의 오류 코드 */
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "REAUTH_REQUIRED"
  | "NOT_FOUND"
  | "GOOGLE_API_ERROR"
  | "GOOGLE_NOT_CONFIGURED"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;

  constructor(status: number, code: ErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new ApiError(404, "NOT_FOUND", `${req.method} ${req.path} 경로가 없습니다.`));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let apiError: ApiError;
  if (err instanceof ApiError) {
    apiError = err;
    if (apiError.status >= 500) {
      req.log.warn({ err: apiError.cause ?? apiError }, apiError.message);
    }
  } else if (isBodyParseError(err)) {
    apiError = new ApiError(400, "VALIDATION_ERROR", "요청 본문을 읽을 수 없습니다.");
  } else {
    req.log.error({ err }, "처리하지 못한 오류");
    apiError = new ApiError(500, "INTERNAL_ERROR", "서버 오류가 발생했습니다.");
  }
  res.status(apiError.status).json({ error: { code: apiError.code, message: apiError.message } });
};

/** express.json()이 잘못된 JSON에서 던지는 오류 */
function isBodyParseError(err: unknown): boolean {
  return err instanceof SyntaxError && "type" in err && err.type === "entity.parse.failed";
}
