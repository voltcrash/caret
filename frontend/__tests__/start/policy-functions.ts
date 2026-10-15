// Only the runtime-test entry imports these functions.
import { createServerFn } from "@tanstack/solid-start";
import { getRequest } from "@tanstack/solid-start/server";
import { createServiceContext } from "../../src/server/context.server";
import { runOperation } from "../../src/server/operation.server";
import { revokeAllTokens } from "@oxytype/backend/services/account";
import { test } from "@oxytype/backend/services/admin";
export const adminProbe = createServerFn({ method: "POST" }).handler(
  async () =>
    await runOperation(
      createServiceContext(getRequest(), true),
      "admin.test",
      { query: undefined, body: undefined, params: undefined },
      test,
    ),
);
export const freshProbe = createServerFn({ method: "POST" }).handler(
  async () =>
    await runOperation(
      createServiceContext(getRequest(), true),
      "users.revokeAllTokens",
      { query: undefined, body: undefined, params: undefined },
      revokeAllTokens,
    ),
);
