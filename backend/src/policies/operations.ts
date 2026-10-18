import { contract } from "@oxytype/contracts";
import type { EndpointMetadata } from "@oxytype/contracts/util/api";
import { isAppRoute, type AppRoute, type AppRouter } from "@ts-rest/core";

type Ids<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends AppRoute
    ? `${P}${K}`
    : Ids<T[K], `${P}${K}.`>;
}[keyof T & string];

/** Stable operation identity (`users.get`); independent of transport or order. */
export type OperationId = Ids<typeof contract>;

export type Operation = {
  id: OperationId;
  route: AppRoute;
  metadata: EndpointMetadata;
};

const operations = new Map<string, Operation>();
(function register(router: AppRouter, prefix: string): void {
  for (const [key, route] of Object.entries(router)) {
    if (!isAppRoute(route)) {
      register(route, `${prefix}${key}.`);
      continue;
    }
    const id = `${prefix}${key}` as OperationId;
    operations.set(id, {
      id,
      route,
      metadata: route.metadata ?? {},
    });
  }
})(contract, "");

export function getOperation(id: OperationId): Operation {
  const operation = operations.get(id);
  if (operation === undefined) throw new Error(`Unknown operation: ${id}`);
  return operation;
}

/** Reverse lookup for transports that dispatch by contract route. */
export function operationForRoute(route: AppRoute): Operation | undefined {
  for (const operation of operations.values()) {
    if (operation.route === route) return operation;
  }
  return undefined;
}

export function allOperations(): Operation[] {
  return [...operations.values()];
}
