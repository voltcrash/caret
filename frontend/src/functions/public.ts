import { createServerFn } from "@tanstack/solid-start";
import { z } from "zod";
import { readTypingStats } from "../server/public.server";

export const getTypingStats = createServerFn({ method: "GET" })
  .validator(z.undefined())
  .handler(async ({ context }) => await readTypingStats(context.services));
