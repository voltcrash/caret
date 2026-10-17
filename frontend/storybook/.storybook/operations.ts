import type { OperationResult } from "../../src/data/operation-result";

/** Stories render without a Start server; every operation is unavailable. */
export const webOperations = new Proxy(
  {},
  {
    get: (_target, id) =>
      typeof id !== "string"
        ? undefined
        : async (): Promise<OperationResult<never>> => ({
            ok: false,
            status: 503,
            message: "Operations are unavailable in Storybook",
          }),
  },
);
