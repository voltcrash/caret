import { vi } from "vite-plus/test";
import type { OperationResult } from "../../src/data/operation-result";
import type { WebOperationId } from "../../src/data/operations";

type Handler = (data: Record<string, unknown>, signal: AbortSignal) => unknown;

const handlers = new Map<string, Handler>();

/** Every call the browser operation client made, in order. */
export const operationCalls = vi.fn<(id: string, data: unknown) => void>();

/**
 * Answer an operation in unit tests. The handler receives the JSON-normalized
 * input and returns an OperationResult (see `ok`/`fail`) or throws.
 */
export function mockOperation(id: WebOperationId, handler: Handler): void {
  handlers.set(id, handler);
}

/** Reuse historical HTTP fixture data while exercising the real function client. */
export function mockHttpFixture(id: WebOperationId, handler: Handler): void {
  mockOperation(id, async (input, signal) => {
    const response = (await handler(input, signal)) as {
      status: number;
      body: { data?: unknown; message?: string; validationErrors?: string[] };
    };
    return response.status === 200
      ? ok(response.body.data, response.body.message)
      : fail(
          response.status,
          response.body.message ?? "",
          response.body.validationErrors,
        );
  });
}

export function resetOperations(): void {
  handlers.clear();
  operationCalls.mockClear();
}

export function ok<T>(data: T, message = ""): OperationResult<T> {
  return { ok: true, status: 200, message, data };
}

export function fail(
  status: number,
  message: string,
  validationErrors?: string[],
): OperationResult<never> {
  return { ok: false, status, message, validationErrors };
}

/** Test stand-in for Start's server-function map (see vitest config). */
export const webOperations = new Proxy(
  {},
  {
    get: (_target, id) =>
      typeof id !== "string"
        ? undefined
        : async (options: {
            data: Record<string, unknown>;
            signal: AbortSignal;
          }) => {
            operationCalls(id, options.data);
            const handler = handlers.get(id);
            if (handler === undefined) {
              return fail(500, `Unmocked operation ${id}`);
            }
            return await handler(options.data, options.signal);
          },
  },
);
