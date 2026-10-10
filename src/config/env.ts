import { z } from "zod";

/** `.env`에 `KEY=`만 적은 경우처럼 빈 문자열은 값이 없는 것으로 본다. */
const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional(),
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, "32자 이상이어야 합니다"),
  TOKEN_ENC_KEY: z
    .string()
    .refine(
      (value) => Buffer.from(value, "base64").length === 32,
      "32바이트를 base64로 인코딩한 값이어야 합니다",
    ),
  // 구글 OAuth 웹 클라이언트. 없으면 구글 로그인만 꺼지고 데모 로그인은 된다.
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  GOOGLE_REDIRECT_URI: optionalString,
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    throw new Error(`환경변수 오류: ${issues}`);
  }
  return parsed.data;
}
