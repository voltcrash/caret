import { z } from "zod";

// Turnstile tokens are opaque, single-use, and at most 2048 characters.
export const CaptchaTokenSchema = z.string().min(1).max(2048);

export type CaptchaAction =
  | "signup"
  | "user-report"
  | "quote-submit"
  | "quote-report";
