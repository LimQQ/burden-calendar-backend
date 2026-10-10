import { OAuth2Client } from "google-auth-library";

export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export interface GoogleIdentity {
  sub: string;
  email: string | null;
  name: string | null;
}

export interface GoogleTokens {
  /** 사용자가 처음 동의할 때만 온다. 다시 로그인하면 없을 수 있다. */
  refreshToken: string | null;
  scopes: string[];
}

/** 구글 로그인 확인. 테스트에서는 가짜 구현으로 바꾼다. */
export interface GoogleAuth {
  /** 실패하면 예외를 던진다. */
  verifyIdToken(idToken: string): Promise<GoogleIdentity>;
  /** 앱이 받은 serverAuthCode를 토큰으로 바꾼다. 실패하면 예외를 던진다. */
  exchangeCode(serverAuthCode: string): Promise<GoogleTokens>;
}

export interface GoogleAuthConfig {
  clientId: string;
  clientSecret: string;
  /** 모바일 앱의 serverAuthCode는 비워 둔다. 웹에서 시험할 때만 `postmessage`. */
  redirectUri?: string | undefined;
}

export function createGoogleAuth({
  clientId,
  clientSecret,
  redirectUri,
}: GoogleAuthConfig): GoogleAuth {
  const client = new OAuth2Client({ clientId, clientSecret, ...(redirectUri && { redirectUri }) });
  return {
    async verifyIdToken(idToken) {
      const ticket = await client.verifyIdToken({ idToken, audience: clientId });
      const payload = ticket.getPayload();
      if (!payload?.sub) {
        throw new Error("idToken에 사용자 id(sub)가 없습니다.");
      }
      return { sub: payload.sub, email: payload.email ?? null, name: payload.name ?? null };
    },
    async exchangeCode(serverAuthCode) {
      const { tokens } = await client.getToken(serverAuthCode);
      return {
        refreshToken: tokens.refresh_token ?? null,
        scopes: tokens.scope?.split(" ").filter(Boolean) ?? [],
      };
    },
  };
}
