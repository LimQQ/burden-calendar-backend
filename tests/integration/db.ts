import type { Db } from "../../src/db.js";

/** 통합 테스트용 DB. docker compose의 db 서비스에 burden_test 데이터베이스를 따로 쓴다. */
export const TEST_DATABASE_URL =
  process.env["TEST_DATABASE_URL"] ??
  "postgresql://burden:burden@localhost:5432/burden_test?schema=public";

/** 모든 테이블이 User를 참조하므로 User를 비우면 전부 비워진다. */
export async function resetDb(db: Db): Promise<void> {
  await db.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
}
