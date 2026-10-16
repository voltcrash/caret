import "@tanstack/solid-start/server-only";
import {
  setResponseHeader,
  setResponseStatus,
} from "@tanstack/solid-start/server";
import {
  admit,
  assertAvailable,
  describeFailure,
  execute,
  type Invocation,
  type OperationData,
  type PolicyScope,
  type RawOperationInput,
} from "@oxytype/backend/policies/operation-runner";
import type { OperationId } from "@oxytype/backend/policies/operations";
import type { OperationResult } from "../data/operation-result";
import type { ServiceContext as RequestContext } from "./context.server";
import { migrateConfig } from "@oxytype/typing-core/config/migrate";
import { PartialConfigSchema } from "@oxytype/schemas/configs";
import MonkeyError from "@oxytype/backend/errors";
import {
  GetPresetResponseSchema,
  type GetPresetResponse,
} from "@oxytype/contracts/presets";

function invocation(request: RequestContext): Invocation {
  return {
    runtime: request.runtime,
    requestId: request.requestId,
    background: request.background,
    headers: request.request.headers,
    clientIp: request.clientIp,
    setHeader: setResponseHeader,
  };
}

/**
 * One operation through the shared policy runner and its registered service.
 * Identical for SSR and direct RPC; no loopback HTTP. Responses are validated
 * against the contract, so only declared DTO fields leave the server.
 */
export async function callOperation<K extends OperationId>(
  request: RequestContext,
  id: K,
  input: RawOperationInput,
): Promise<OperationResult<OperationData<K>>> {
  const call = invocation(request);
  let scope: PolicyScope | undefined;
  try {
    scope = await admit(call);
    assertAvailable(call, scope, id.startsWith("configuration."));
    const outcome = await execute(call, scope, id, input, {
      // Historical stored preferences must pass their existing migration before
      // the modern strict response schema. HTTP keeps its original raw format.
      validateResponse: id !== "configs.get" && id !== "presets.get",
    });
    if (!outcome.ok) {
      if (request.rpc) setResponseStatus(outcome.status);
      return outcome;
    }
    if (id === "presets.get") {
      const presets = outcome.data as GetPresetResponse["data"];
      const data = presets.map((preset) => ({
        ...preset,
        config: PartialConfigSchema.safeParse(preset.config).success
          ? preset.config
          : { ...migrateConfig(preset.config), tags: preset.config.tags },
      }));
      return {
        ...outcome,
        status: 200,
        data: GetPresetResponseSchema.parse({ message: outcome.message, data })
          .data as OperationData<K>,
      };
    }
    if (id === "configs.get" && outcome.data !== null) {
      if (typeof outcome.data === "object" && "config" in outcome.data) {
        throw new MonkeyError(
          500,
          "Config data is not in the correct format. Please refresh the page or contact support.",
        );
      }
      return {
        ...outcome,
        status: 200,
        data: PartialConfigSchema.parse(
          migrateConfig(outcome.data as object),
        ) as OperationData<K>,
      };
    }
    return { ...outcome, status: 200 };
  } catch (error) {
    const failure = await describeFailure(error, call, scope, id);
    // SSR calls share the document response; only a direct call owns a status.
    if (request.rpc) setResponseStatus(failure.status);
    return { ok: false, status: failure.status, message: failure.message };
  }
}

/** For loaders and pages whose query/route boundary handles a thrown error. */
export async function runOperation<K extends OperationId>(
  request: RequestContext,
  id: K,
  input: RawOperationInput,
): Promise<OperationData<K>> {
  const result = await callOperation(request, id, input);
  if (!result.ok) throw new Error(result.message);
  return result.data;
}
