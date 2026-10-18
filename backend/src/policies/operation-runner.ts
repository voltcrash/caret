import { checkZodSchema } from "@ts-rest/core";
import { getCachedConfiguration } from "../init/configuration";
import { addLog } from "../dal/logs";
import { GUEST, type ServiceContext } from "../services/context";
import {
  developmentOnlyOperations,
  operationServices,
  type OperationServices,
} from "../services/operations/registry";
import MonkeyError from "../utils/error";
import Logger from "../utils/logger";
import { isDevEnvironment } from "../utils/misc";
import type { MonkeyResponse } from "../utils/monkey-response";
import { authenticate } from "./authentication";
import { verifyConfiguration } from "./configuration";
import { getOperation, type OperationId } from "./operations";
import { verifyPermissions } from "./permission";
import {
  checkBadAuthentication,
  enforceLimit,
  enforceOperationLimit,
  recordBadAuthentication,
  type SetPolicyHeader,
} from "./rate-limit";
import {
  validateOperationInput,
  type InputValidation,
  type ValidationFailure,
} from "./validation";

type ValidatedInput = Extract<InputValidation, { success: true }>["input"];

/** One HTTP request or server-function call, as seen by policies. */
export type Invocation = {
  runtime: ServiceContext["runtime"];
  requestId: string;
  background: ServiceContext["background"];
  headers: Headers;
  /** Trusted client address (see `client-ip`). */
  clientIp: string;
  setHeader: SetPolicyHeader;
};

/** Identity/config/client state shared by every policy of one invocation. */
export type PolicyScope = Pick<
  ServiceContext,
  "actor" | "configuration" | "client"
>;

export type RawOperationInput = {
  params?: unknown;
  query?: unknown;
  body?: unknown;
  headers?: unknown;
};

type ServiceOf<K extends OperationId> = OperationServices[K];
export type OperationRequest<K extends OperationId> = Parameters<
  ServiceOf<K>
>[1];
export type OperationData<K extends OperationId> =
  Awaited<ReturnType<ServiceOf<K>>> extends MonkeyResponse<infer T> ? T : never;

export type OperationOutcome<K extends OperationId> =
  | { ok: true; message: string; data: OperationData<K> }
  | ({ ok: false; status: 422 } & ValidationFailure);

/** Request-wide gates; run once before any operation is selected. */
export async function admit(invocation: Invocation): Promise<PolicyScope> {
  const scope: PolicyScope = {
    actor: { ...GUEST },
    configuration: await getCachedConfiguration(true),
    client: {
      ip: invocation.clientIp,
      userAgent: invocation.headers.get("user-agent") ?? undefined,
    },
  };
  await checkBadAuthentication(scope);
  await enforceLimit(
    "root",
    { window: "hour", max: 1000 },
    scope,
    invocation.setHeader,
    false,
  );
  const slowdown = scope.configuration.dev.responseSlowdownMs;
  if (invocation.runtime.env.MODE === "dev" && slowdown > 0) {
    await new Promise((resolve) => setTimeout(resolve, slowdown));
  }
  return scope;
}

/** Configuration reads stay available during maintenance. */
export function assertAvailable(
  invocation: Invocation,
  scope: PolicyScope,
  configurationRequest: boolean,
): void {
  if (
    !configurationRequest &&
    (invocation.runtime.env.MAINTENANCE === "true" ||
      scope.configuration.maintenance)
  ) {
    throw new MonkeyError(503, "Server is down for maintenance");
  }
}

/**
 * Operation policies in their legacy order: authentication, operation limit,
 * configuration gate, permissions, development gate, then contract input.
 * Mutates `scope.actor` so failures record against the resolved identity.
 */
export async function execute<K extends OperationId>(
  invocation: Invocation,
  scope: PolicyScope,
  id: K,
  raw: RawOperationInput,
  options: { validateResponse: boolean },
): Promise<OperationOutcome<K>> {
  const operation = getOperation(id);
  scope.actor = await authenticate({
    headers: invocation.headers,
    configuration: scope.configuration,
    options: operation.metadata.authenticationOptions,
    endpoint: id,
  });
  await enforceOperationLimit(operation.metadata, scope, invocation.setHeader);
  verifyConfiguration(scope.configuration, operation.metadata);
  await verifyPermissions(scope.actor, operation.metadata);
  if (developmentOnlyOperations.has(id) && !isDevEnvironment()) {
    throw new MonkeyError(
      503,
      "Development endpoints are only available in DEV mode.",
    );
  }
  const validation = validateOperationInput(operation.route, {
    params: raw.params ?? {},
    query: raw.query ?? {},
    body: raw.body ?? {},
    headers: raw.headers,
  });
  if (!validation.success) {
    return {
      ok: false,
      status: 422,
      message: validation.message,
      validationErrors: validation.validationErrors,
    };
  }
  const service = operationServices[id] as (
    context: ServiceContext,
    input: ValidatedInput,
  ) => Promise<MonkeyResponse<unknown>>;
  const response = await service(
    {
      ...scope,
      runtime: invocation.runtime,
      requestId: invocation.requestId,
      background: invocation.background,
    },
    validation.input,
  );
  const result = { message: response.message, data: response.data };
  if (options.validateResponse) {
    // Keep the former JSON boundary: omit members, stringify dates, and turn
    // sparse calendar entries into null before validation/Start serialization.
    const serialized = JSON.stringify(result);
    const dto = JSON.parse(serialized) as unknown;
    const validated = checkZodSchema(dto, operation.route.responses[200]);
    if (!validated.success) {
      console.error("Invalid service response", {
        operation: id,
        issues: validated.error.issues.map(({ path, code }) => ({
          path: path.join("."),
          code,
        })),
      });
      throw new MonkeyError(500, "Invalid service response");
    }
    return {
      ok: true,
      ...(validated.data as typeof result),
    } as OperationOutcome<K>;
  }
  return { ok: true, ...result } as OperationOutcome<K>;
}

export type OperationFailure = {
  status: number;
  message: string;
  uid: string;
  /** Present for server errors only. */
  errorId?: string;
};

/**
 * Legacy error mapping, bad-authentication accounting and server-error audit
 * logging; shared so every transport reports failures identically.
 */
export async function describeFailure(
  error: unknown,
  invocation: Invocation,
  scope: PolicyScope | undefined,
  endpoint: string,
): Promise<OperationFailure> {
  const monkeyError = error instanceof MonkeyError ? error : undefined;
  const errorId = monkeyError?.errorId ?? invocation.requestId;
  const uid = monkeyError?.uid ?? scope?.actor.uid ?? "";
  let status = 500;
  let message: string;
  if (error instanceof URIError || error instanceof SyntaxError) {
    status = 400;
    message = "Unprocessable request";
  } else if (monkeyError !== undefined) {
    status = monkeyError.status;
    message = monkeyError.message;
  } else {
    message = `Oops! Our monkeys dropped their bananas. Please try again later. - ${errorId}`;
  }
  if (scope !== undefined) await recordBadAuthentication(scope, status);
  const detail = error instanceof Error ? error : new Error(String(error));
  if (!isDevEnvironment() && status >= 500 && status !== 503) {
    invocation.background(
      addLog(
        "system_error",
        `${status} ${errorId} ${detail.message} ${detail.stack}`,
        uid,
      ),
    );
    console.error(
      JSON.stringify({
        errorId,
        requestId: invocation.requestId,
        timestamp: Date.now(),
        status,
        uid,
        message: detail.message,
        stack: detail.stack,
        endpoint,
      }),
    );
  } else {
    Logger.error(`Error: ${detail.message} Stack: ${detail.stack}`);
  }
  return status >= 500
    ? { status, message, uid, errorId }
    : { status, message, uid };
}
