import { execSync } from "node:child_process";
import { createDb } from "../../src/db.js";
import { TEST_DATABASE_URL } from "./db.js";

/** 테스트 데이터베이스가 없으면 만들고 마이그레이션을 적용한다. */
export default async function setup(): Promise<void> {
  const target = new URL(TEST_DATABASE_URL);
  const dbName = decodeURIComponent(target.pathname.slice(1));
  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = "/postgres";
  adminUrl.search = "";

  const admin = createDb(adminUrl.toString());
  try {
    const rows = await admin.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = ${dbName}) AS "exists"`;
    if (!rows[0]?.exists) {
      await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName.replaceAll('"', '""')}"`);
    }
  } catch (err) {
    throw new Error(
      `테스트 DB(${target.host})에 연결하지 못했습니다. 먼저 docker compose up -d db 를 실행하세요.`,
      { cause: err },
    );
  } finally {
    await admin.$disconnect();
  }

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
    stdio: "inherit",
  });
}
