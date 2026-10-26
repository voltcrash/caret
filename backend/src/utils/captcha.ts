import type { CaptchaAction } from "@caret/contracts/captcha";

import { envValue } from "../runtime/env";
import { getFrontendUrl, isDevEnvironment } from "./misc";

const testSecrets = new Set([
  "1x0000000000000000000000000000000AA",
  "2x0000000000000000000000000000000AA",
  "3x0000000000000000000000000000000AA",
]);

export async function verify(
  captcha: string,
  action: CaptchaAction,
): Promise<boolean> {
  if (captcha.length === 0 || captcha.length > 2048) return false;
  const secret = envValue("TURNSTILE_SECRET_KEY");
  if (secret === undefined || secret === "") {
    throw new Error("TURNSTILE_SECRET_KEY is not defined");
  }
  const testing = testSecrets.has(secret);
  if (testing && !isDevEnvironment()) {
    throw new Error("Turnstile test secrets are only allowed in MODE=dev");
  }
  const hostname = new URL(getFrontendUrl()).hostname;
  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: captcha }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) return false;
  const data: unknown = await response.json();
  if (typeof data !== "object" || data === null || !("success" in data)) {
    return false;
  }
  if (data.success !== true) return false;

  // Dummy keys return fixed metadata; still validate with Siteverify in dev.
  if (testing) return captcha === "XXXX.DUMMY.TOKEN.XXXX";
  return (
    "hostname" in data &&
    data.hostname === hostname &&
    "action" in data &&
    data.action === action
  );
}
