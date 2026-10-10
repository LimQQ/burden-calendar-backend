import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createTokenCipher } from "../../src/auth/token-cipher.js";

const cipher = createTokenCipher(randomBytes(32));

describe("TokenCipher", () => {
  it("암호화한 값을 다시 풀 수 있다", () => {
    const encoded = cipher.encrypt("1//refresh-token");
    expect(encoded).toMatch(/^v1\./);
    expect(encoded).not.toContain("refresh-token");
    expect(cipher.decrypt(encoded)).toBe("1//refresh-token");
  });

  it("같은 값도 매번 다르게 암호화한다", () => {
    expect(cipher.encrypt("same")).not.toBe(cipher.encrypt("same"));
  });

  it("변조된 값은 풀지 못한다", () => {
    const parts = cipher.encrypt("1//refresh-token").split(".");
    const data = parts[3]!;
    parts[3] = (data[0] === "A" ? "B" : "A") + data.slice(1);
    expect(() => cipher.decrypt(parts.join("."))).toThrow();
  });

  it("다른 키로는 풀지 못한다", () => {
    const other = createTokenCipher(randomBytes(32));
    expect(() => other.decrypt(cipher.encrypt("1//refresh-token"))).toThrow();
  });

  it("형식이 틀리면 알려 준다", () => {
    expect(() => cipher.decrypt("plain-token")).toThrow(/형식/);
  });

  it("32바이트가 아닌 키는 거부한다", () => {
    expect(() => createTokenCipher(randomBytes(16))).toThrow(/32바이트/);
  });
});
