import "@tanstack/solid-start/server-only";
import {
  setResponseHeader,
  setResponseStatus,
} from "@tanstack/solid-start/server";
import {
  COMPATIBILITY_CHECK,
  COMPATIBILITY_CHECK_HEADER,
} from "@oxytype/contracts";
import {
  getOperation,
  type OperationId,
} from "@oxytype/backend/policies/operations";
import { authenticate } from "@oxytype/backend/policies/authentication";
import { verifyConfiguration } from "@oxytype/backend/policies/configuration";
import { verifyPermissions } from "@oxytype/backend/policies/permission";
import {
  enforceLimit,
  enforceOperationLimit,
  checkBadAuthentication,
  recordBadAuthentication,
} from "@oxytype/backend/policies/rate-limit";
import { getCachedConfiguration } from "@oxytype/backend/configuration";
import {
  GUEST,
  type ServiceContext,
  type OperationInput,
} from "@oxytype/backend/services/context";
import MonkeyError from "@oxytype/backend/errors";
import { addLog } from "@oxytype/backend/audit";
import { checkZodSchema } from "@ts-rest/core";
import type { ServiceContext as RequestContext } from "./context.server";

/** Identical policy/service path for SSR and direct RPC. No loopback HTTP. */
export async function runOperation<Q, B, P, R>(
  request: RequestContext,
  id: OperationId,
  input: OperationInput<Q, B, P>,
  service: (
    context: ServiceContext,
    input: OperationInput<Q, B, P>,
  ) => Promise<R>,
): Promise<R> {
  const operation = getOperation(id);
  let context: ServiceContext | undefined;
  setResponseHeader(COMPATIBILITY_CHECK_HEADER, String(COMPATIBILITY_CHECK));
  try {
    context = {
      actor: { ...GUEST },
      runtime: request.runtime,
      requestId: request.requestId,
      background: request.background,
      configuration: await getCachedConfiguration(true),
      client: {
        ip: request.clientIp,
        userAgent: request.request.headers.get("user-agent") ?? undefined,
      },
    };
    await checkBadAuthentication(context);
    await enforceLimit(
      "root",
      { window: "hour", max: 1000 },
      context,
      setResponseHeader,
      false,
    );
    if (
      (request.runtime.env.MAINTENANCE === "true" ||
        context.configuration.maintenance) &&
      !id.startsWith("configuration.")
    ) {
      throw new MonkeyError(503, "Server is down for maintenance");
    }
    context.actor = await authenticate({
      headers: request.request.headers,
      configuration: context.configuration,
      options: operation.metadata.authenticationOptions,
      endpoint: id,
    });
    await enforceOperationLimit(operation.metadata, context, setResponseHeader);
    verifyConfiguration(context.configuration, operation.metadata);
    await verifyPermissions(context.actor, operation.metadata);
    const query = checkZodSchema(input.query, operation.route.query);
    const params = checkZodSchema(input.params, operation.route.pathParams);
    const body = checkZodSchema(
      input.body,
      "body" in operation.route ? operation.route.body : null,
    );
    if (!query.success || !params.success || !body.success) {
      throw new MonkeyError(422, "Invalid operation input");
    }
    const result = await service(context, {
      query: query.data,
      params: params.data,
      body: body.data,
    } as OperationInput<Q, B, P>);
    const validated = checkZodSchema(result, operation.route.responses[200]);
    if (!validated.success) {
      throw new MonkeyError(500, "Invalid service response");
    }
    return validated.data as R;
  } catch (error) {
    const status = error instanceof MonkeyError ? error.status : 500;
    if (context !== undefined) await recordBadAuthentication(context, status);
    if (status >= 500 && status !== 503) {
      request.background(
        addLog(
          "system_error",
          `${status} ${request.requestId} ${String(error)}`,
          context?.actor.uid ?? "",
        ),
      );
      console.error("Operation failed", {
        operation: id,
        requestId: request.requestId,
        error,
      });
    }
    setResponseStatus(status);
    throw new Error(
      error instanceof MonkeyError
        ? error.message
        : `Internal Server Error ${request.requestId}`,
    );
  }
}
