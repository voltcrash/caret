import { createServerFn } from "@tanstack/solid-start";
import { z } from "zod";
import { readAccountStats } from "../server/account.server";
export const getAccountStats = createServerFn({ method: "GET" })
  .validator(z.undefined())
  .handler(async ({ context }) => await readAccountStats(context.services));
