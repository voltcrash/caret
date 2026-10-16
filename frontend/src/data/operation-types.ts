import type { contract } from "@oxytype/contracts";
import type {
  AppRoute,
  ClientInferRequest,
  ClientInferResponseBody,
} from "@ts-rest/core";

type Contract = typeof contract;
type Group = keyof Contract & string;

/** Stable contract operation identity, e.g. `users.getTags`. */
export type ContractOperationId = {
  [G in Group]: `${G}.${keyof Contract[G] & string}`;
}[Group];

type RouteOf<K extends ContractOperationId> =
  K extends `${infer G extends Group}.${infer N}`
    ? N extends keyof Contract[G]
      ? Contract[G][N] extends AppRoute
        ? Contract[G][N]
        : never
      : never
    : never;

type ContractRequest<K extends ContractOperationId> = ClientInferRequest<
  RouteOf<K>
>;

type Members<K extends ContractOperationId> = {
  [
    P in keyof ContractRequest<K> as P extends "query" | "body" | "params"
      ? P
      : never
  ]: ContractRequest<K>[P];
};

/**
 * Pre-validation input: the contract's query, body and path parameters.
 * A member whose fields are all optional may be omitted, as with the former
 * HTTP client.
 */
export type OperationRequest<K extends ContractOperationId> = {
  [
    P in keyof Members<K> as Record<string, never> extends Members<K>[P]
      ? P
      : never
  ]?: Members<K>[P];
} & {
  [
    P in keyof Members<K> as Record<string, never> extends Members<K>[P]
      ? never
      : P
  ]: Members<K>[P];
};

/** The contract's validated success DTO. */
export type OperationResponse<K extends ContractOperationId> =
  ClientInferResponseBody<RouteOf<K>, 200> extends { data: infer D }
    ? D
    : never;
