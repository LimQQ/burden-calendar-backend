import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { createLogger } from "./logger.js";

const env = loadEnv();
const logger = createLogger(env);
const app = createApp({ logger });

const server = app.listen(env.PORT, () => {
  logger.info(`서버 시작: http://localhost:${env.PORT}`);
});

// Cloud Run과 docker compose는 종료할 때 SIGTERM을 보낸다.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    logger.info(`${signal} 받음, 서버 종료`);
    server.close(() => process.exit(0));
  });
}
