// Only the runtime-test entry imports these functions.
import { createServerFn } from "@tanstack/solid-start";
import { getRequest } from "@tanstack/solid-start/server";
import { createServiceContext } from "../../src/server/context.server";
import { runOperation } from "../../src/server/operation.server";
export const adminProbe = createServerFn({ method: "POST" }).handler(
  async () =>
    await runOperation(
      createServiceContext(getRequest(), true),
      "admin.test",
      {},
    ),
);
export const freshProbe = createServerFn({ method: "POST" }).handler(
  async () =>
    await runOperation(
      createServiceContext(getRequest(), true),
      "users.revokeAllTokens",
      {},
    ),
);
