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
/** Three SSR-style operations on one request context. */
export const admissionProbe = createServerFn({ method: "POST" }).handler(
  async () => {
    const services = createServiceContext(getRequest(), false);
    for (let call = 0; call < 3; call++) {
      await runOperation(services, "configuration.get", {});
    }
    return "admitted";
  },
);
