import { createServerFn } from "@tanstack/solid-start";
import { z } from "zod";
import { readSpeedHistogram, readTypingStats } from "../server/public.server";

export const getTypingStats = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.undefined().parse(input))
  .handler(async ({ context }) => await readTypingStats(context.services));

export const getSpeedHistogram = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.undefined().parse(input))
  .handler(async ({ context }) => await readSpeedHistogram(context.services));
