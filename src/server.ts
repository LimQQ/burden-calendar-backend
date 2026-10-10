import { createApp } from "./app.js";
import { createGoogleAuth } from "./auth/google.js";
import { createJwtService } from "./auth/jwt.js";
import { createTokenCipher } from "./auth/token-cipher.js";
import { loadEnv } from "./config/env.js";
import { createDb } from "./db.js";
import { createGoogleCalendarFactory } from "./google/calendar.js";
import { createLogger } from "./logger.js";

const env = loadEnv();
const logger = createLogger(env);
const db = createDb(env.DATABASE_URL);

const googleClient =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
    : null;
if (!googleClient) {
  logger.warn("GOOGLE_CLIENT_ID·GOOGLE_CLIENT_SECRET이 없어 구글 로그인·동기화가 꺼져 있습니다.");
}

const app = createApp({
  logger,
  db,
  jwt: createJwtService(env.JWT_SECRET),
  googleAuth: googleClient
    ? createGoogleAuth({ ...googleClient, redirectUri: env.GOOGLE_REDIRECT_URI })
    : null,
  calendarFor: googleClient ? createGoogleCalendarFactory(googleClient) : null,
  tokenCipher: createTokenCipher(Buffer.from(env.TOKEN_ENC_KEY, "base64")),
});

const server = app.listen(env.PORT, () => {
  logger.info(`서버 시작: http://localhost:${env.PORT}`);
});

// Cloud Run과 docker compose는 종료할 때 SIGTERM을 보낸다.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    logger.info(`${signal} 받음, 서버 종료`);
    server.close(() => {
      void db.$disconnect().finally(() => process.exit(0));
    });
  });
}
