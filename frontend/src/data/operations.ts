import { envConfig } from "virtual:env-config";
import { captureAccount } from "../app/account-scope";
import { captureApplication } from "../app/application";
import { webOperations } from "../functions/operations";
import { OperationError, type OperationResult } from "./operation-result";
import type {
  ContractOperationId,
  OperationRequest,
  OperationResponse,
} from "./operation-types";

type WebOperations =
  (typeof import("../functions/operations"))["webOperations"];
export type WebOperationId = keyof WebOperations;

type Lease = { signal: AbortSignal; assertCurrent: () => void };

/** Server data belongs to the application unless it is the actor's own. */
const applicationGroups = new Set(["configuration", "psas", "public"]);
function capture(id: WebOperationId): Lease {
  const [group, name = ""] = id.split(".");
  const applicationOwned =
    applicationGroups.has(group ?? "") ||
    (group === "leaderboards" && !name.endsWith("Rank"));
  return applicationOwned ? captureApplication() : captureAccount();
}

const timeouts: Partial<Record<ContractOperationId, number>> = {
  "dev.generateData": 240_000,
};

type Input<K extends WebOperationId> =
  Record<string, never> extends OperationRequest<K>
    ? [input?: OperationRequest<K>]
    : [input: OperationRequest<K>];

/**
 * Call one first-party web operation. Its account/application lease is taken
 * before the function chunk loads; a response arriving after that owner ends
 * rejects with AbortError rather than restoring another actor's data.
 * Expected failures resolve with their legacy status and message.
 */
export async function operation<K extends WebOperationId>(
  id: K,
  ...[input]: Input<K>
): Promise<OperationResult<OperationResponse<K>>> {
  if (envConfig.devOffline) {
    return {
      ok: false,
      status: 503,
      message: "Backend requests are unavailable in frontend-only development",
    };
  }
  const lease = capture(id);
  const controller = new AbortController();
  const abort = (): void => controller.abort(lease.signal.reason);
  if (lease.signal.aborted) abort();
  else lease.signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(
    () => controller.abort(new Error("request timed out")),
    timeouts[id] ?? 10_000,
  );
  try {
    lease.assertCurrent();
    const call = webOperations[id] as (options: {
      data: unknown;
      signal: AbortSignal;
    }) => Promise<OperationResult<OperationResponse<K>>>;
    const data = asJson(input);
    const result = await call({ data, signal: controller.signal });
    lease.assertCurrent();
    if (!result.ok) {
      console.error(`${id} failed`, {
        status: result.status,
        message: result.message,
      });
    }
    return result;
  } catch (error) {
    lease.assertCurrent();
    const reason: unknown = controller.signal.aborted
      ? controller.signal.reason
      : error;
    const message =
      reason instanceof Error
        ? reason.message.includes("timed out")
          ? "request took too long to complete"
          : reason.message
        : "Unknown error";
    return { ok: false, status: 500, message };
  } finally {
    clearTimeout(timer);
    lease.signal.removeEventListener("abort", abort);
  }
}

/**
 * The former HTTP transport sent JSON. Keep its semantics (undefined members
 * omitted, dates as strings) so hashes and validation see identical input.
 */
function asJson(input: unknown): unknown {
  if (input === undefined) return {};
  const json = JSON.stringify(input);
  return JSON.parse(json) as unknown;
}

/** Unwrap a success or throw its message; for Query functions and loaders. */
export async function operationData<K extends WebOperationId>(
  id: K,
  ...input: Input<K>
): Promise<OperationResponse<K>> {
  const result = await operation(id, ...input);
  if (!result.ok) throw new OperationError(result);
  return result.data;
}
