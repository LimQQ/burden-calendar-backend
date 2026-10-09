import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // prisma generate는 DB 없이도 돌아야 해서 env() 대신 process.env를 쓴다.
    url: process.env["DATABASE_URL"],
  },
});
