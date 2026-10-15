import { createHmac } from "node:crypto";
export function authCookie(token: string): string {
  const signature = createHmac(
    "sha256",
    "stage-one-local-only-secret-at-least-32-characters",
  )
    .update(token)
    .digest("base64");
  return `oxytype.session_token=${encodeURIComponent(`${token}.${signature}`)}; Path=/; HttpOnly; SameSite=Lax`;
}
