import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

export type Db = PrismaClient;

/** 앱 전체에서 하나만 만들어 쓴다(인스턴스마다 연결 풀이 생긴다). */
export function createDb(databaseUrl: string): Db {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}
