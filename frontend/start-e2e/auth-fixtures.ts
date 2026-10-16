import { createHash, createHmac } from "node:crypto";
export function authCookie(token: string): string {
  const signature = createHmac(
    "sha256",
    "stage-one-local-only-secret-at-least-32-characters",
  )
    .update(token)
    .digest("base64");
  return `oxytype.session_token=${encodeURIComponent(`${token}.${signature}`)}; Path=/; HttpOnly; SameSite=Lax`;
}

/** Independent local edge clients keep browser tests from sharing production rate buckets. */
export function fixtureClientIp(testId: string): string {
  const bytes = createHash("sha256").update(testId).digest();
  return `198.18.${bytes[0]}.${bytes[1]}`;
}
