import { createServerFn } from "@tanstack/solid-start";
import { z } from "zod";
import { readSessionState } from "../server/session.server";
export const getSessionState = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.undefined().parse(input))
  .handler(async ({ context }) => await readSessionState(context.services));
