import { pino, type Logger } from "pino";
import type { Env } from "./config/env.js";

export function createLogger(env: Env): Logger {
  return pino({
    level: env.LOG_LEVEL,
    // 토큰이 로그에 남지 않게 인증 헤더는 가린다.
    redact: ["req.headers.authorization", "req.headers.cookie"],
    ...(env.NODE_ENV === "development" && { transport: { target: "pino-pretty" } }),
  });
}
