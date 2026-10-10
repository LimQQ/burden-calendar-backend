import { Router } from "express";
import { z } from "zod";
import { CALENDAR_SCOPE, type GoogleAuth } from "../auth/google.js";
import type { JwtService } from "../auth/jwt.js";
import type { TokenCipher } from "../auth/token-cipher.js";
import type { Db } from "../db.js";
import { ApiError } from "../errors.js";
import { parseBody } from "../validate.js";

export const DEMO_USER_NAME = "데모 사용자";

const googleLoginBody = z.object({
  idToken: z.string().min(1),
  serverAuthCode: z.string().min(1),
});

// 본문 없이 보내도 된다.
const demoLoginBody = z.object({ scenario: z.string().optional() }).optional();

export interface AuthRouterDeps {
  db: Db;
  jwt: JwtService;
  googleAuth: GoogleAuth | null;
  tokenCipher: TokenCipher;
}

/** /v1/auth 아래에 붙인다. */
export function authRouter({ db, jwt, googleAuth, tokenCipher }: AuthRouterDeps): Router {
  const router = Router();

  router.post("/google", async (req, res) => {
    if (!googleAuth) {
      throw new ApiError(503, "GOOGLE_NOT_CONFIGURED", "서버에 구글 로그인이 설정되지 않았습니다.");
    }
    const { idToken, serverAuthCode } = parseBody(googleLoginBody, req.body);

    const identity = await googleAuth.verifyIdToken(idToken).catch(() => {
      throw new ApiError(401, "UNAUTHENTICATED", "구글 로그인을 확인하지 못했습니다.");
    });
    const tokens = await googleAuth.exchangeCode(serverAuthCode).catch(() => {
      throw new ApiError(401, "UNAUTHENTICATED", "구글 인증 코드를 확인하지 못했습니다.");
    });
    if (!tokens.scopes.includes(CALENDAR_SCOPE)) {
      throw new ApiError(401, "REAUTH_REQUIRED", "캘린더 권한을 허용하고 다시 로그인해 주세요.");
    }

    const existing = await db.user.findUnique({
      where: { googleSub: identity.sub },
      include: { googleCredential: true },
    });
    if (!tokens.refreshToken && !existing?.googleCredential) {
      // 구글은 처음 동의할 때만 refresh token을 준다. 앱이 동의 화면을 다시 띄워야 한다.
      throw new ApiError(401, "REAUTH_REQUIRED", "캘린더 권한을 다시 허용해 주세요.");
    }

    const user = await db.$transaction(async (tx) => {
      const saved = await tx.user.upsert({
        where: { googleSub: identity.sub },
        create: { googleSub: identity.sub, email: identity.email, name: identity.name },
        update: { email: identity.email, name: identity.name },
        include: { profile: true },
      });
      if (tokens.refreshToken) {
        const credential = {
          refreshTokenEnc: tokenCipher.encrypt(tokens.refreshToken),
          scopes: tokens.scopes.join(" "),
        };
        await tx.googleCredential.upsert({
          where: { userId: saved.id },
          create: { userId: saved.id, ...credential },
          update: credential,
        });
      }
      return saved;
    });

    res.json({
      accessToken: await jwt.sign(user.id),
      user: { id: user.id, email: user.email, name: user.name },
      needsOnboarding: user.profile === null,
    });
  });

  router.post("/demo", async (req, res) => {
    const body = parseBody(demoLoginBody, req.body);
    if (body?.scenario !== undefined) {
      throw new ApiError(400, "VALIDATION_ERROR", "scenario는 아직 지원하지 않습니다(Phase 2).");
    }
    const user = await db.user.create({ data: { isDemo: true, name: DEMO_USER_NAME } });
    res.json({
      accessToken: await jwt.sign(user.id),
      user: { id: user.id, email: user.email, name: user.name },
    });
  });

  return router;
}
