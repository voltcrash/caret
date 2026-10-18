import type { Runtime } from "../runtime/env";
import type { Configuration } from "@oxytype/schemas/configuration";

/** Who an operation acts for; established by the authentication policy. */
export type Actor = {
  type: "Bearer" | "Session" | "ApeKey" | "None";
  uid: string;
  email: string;
};

export const GUEST: Actor = Object.freeze({ type: "None", uid: "", email: "" });

/**
 * Everything a service may know about its invocation. Transport adapters
 * (legacy Hono, Start functions/routes) build it after running policies;
 * services never see request objects, headers or framework types.
 */
export type ServiceContext = {
  actor: Actor;
  runtime: Runtime;
  requestId: string;
  background: (task: Promise<unknown>) => void;
  configuration: Configuration;
  /** Trusted client address (see `policies/client-ip`) and agent, for audit logs. */
  client: { ip: string; userAgent?: string };
};

/** Validated operation input; no transport or raw request data. */
export type OperationInput<Q = undefined, B = undefined, P = undefined> = {
  query: Readonly<Q>;
  body: Readonly<B>;
  params: Readonly<P>;
};
