import express, { type Express } from "express";
import type { Logger } from "pino";
import { pinoHttp } from "pino-http";
import { errorHandler, notFoundHandler } from "./errors.js";
import { healthRouter } from "./routes/health.js";

export interface AppDeps {
  logger: Logger;
}

export function createApp({ logger }: AppDeps): Express {
  const app = express();
  app.disable("x-powered-by");

  app.use(pinoHttp({ logger }));
  app.use(express.json());

  app.use(healthRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
