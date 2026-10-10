import express, { type Express } from "express";
import type { Logger } from "pino";
import { pinoHttp } from "pino-http";
import type { GoogleAuth } from "./auth/google.js";
import type { JwtService } from "./auth/jwt.js";
import type { TokenCipher } from "./auth/token-cipher.js";
import type { Db } from "./db.js";
import { errorHandler, notFoundHandler } from "./errors.js";
import { createEventService } from "./events/service.js";
import type { GoogleCalendarFactory } from "./google/calendar.js";
import { authRouter } from "./routes/auth.js";
import { calendarRouter } from "./routes/calendar.js";
import { categoriesRouter } from "./routes/categories.js";
import { eventsRouter } from "./routes/events.js";
import { healthRouter } from "./routes/health.js";
import { meRouter } from "./routes/me.js";

export interface AppDeps {
  logger: Logger;
  db: Db;
  jwt: JwtService;
  /** 구글 OAuth 설정이 없으면 null (구글 로그인·동기화만 꺼진다) */
  googleAuth: GoogleAuth | null;
  calendarFor: GoogleCalendarFactory | null;
  tokenCipher: TokenCipher;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable("x-powered-by");

  app.use(pinoHttp({ logger: deps.logger }));
  app.use(express.json());

  const events = createEventService(deps);

  app.use(healthRouter);
  app.use("/v1/auth", authRouter(deps));
  app.use("/v1/me", meRouter(deps));
  app.use("/v1/events", eventsRouter({ jwt: deps.jwt, events }));
  app.use("/v1/calendar", calendarRouter({ jwt: deps.jwt, events }));
  app.use("/v1/categories", categoriesRouter(deps));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
