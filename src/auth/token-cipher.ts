import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const FORMAT_VERSION = "v1";

export interface TokenCipher {
  encrypt(plain: string): string;
  /** 형식이 틀렸거나 변조됐으면 예외를 던진다. */
  decrypt(encoded: string): string;
}

/**
 * refresh token 암호화(AES-256-GCM).
 * 저장 형식: `v1.<iv>.<인증 태그>.<암호문>` (각 부분은 base64url)
 */
export function createTokenCipher(key: Buffer): TokenCipher {
  if (key.length !== 32) {
    throw new Error("암호화 키는 32바이트여야 합니다.");
  }
  return {
    encrypt(plain) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
      const parts = [iv, cipher.getAuthTag(), data].map((part) => part.toString("base64url"));
      return [FORMAT_VERSION, ...parts].join(".");
    },
    decrypt(encoded) {
      const [version, iv, tag, data, ...rest] = encoded.split(".");
      if (version !== FORMAT_VERSION || !iv || !tag || data === undefined || rest.length > 0) {
        throw new Error("암호화된 토큰의 형식이 올바르지 않습니다.");
      }
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
      decipher.setAuthTag(Buffer.from(tag, "base64url"));
      const plain = Buffer.concat([
        decipher.update(Buffer.from(data, "base64url")),
        decipher.final(),
      ]);
      return plain.toString("utf8");
    },
  };
}
