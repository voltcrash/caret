import {
  COMPATIBILITY_CHECK,
  COMPATIBILITY_CHECK_HEADER,
  contract,
} from "@oxytype/contracts";
import type { EndpointMetadata } from "@oxytype/contracts/util/api";
import { initClient, isZodType } from "@ts-rest/core";

import type { NetworkSettings } from "./settings";
import type { Logger } from "../logging";

export type Fetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;
export type ApiResponse = { status: number; body: unknown; headers: Headers };

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
  get retryable(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}
export class TransportError extends Error {
  constructor(message: string, cause: unknown) {
    super(message, { cause });
    this.name = "TransportError";
  }
}
export function responseError(response: ApiResponse): ApiError {
  const body = response.body;
  const message =
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
      ? body.message
      : `Request failed (${response.status})`;
  return new ApiError(message, response.status);
}

export type ApiOptions = {
  settings: NetworkSettings;
  token?: () => string | undefined;
  fetch?: Fetch;
  onUnauthorized?: () => void;
  logger?: Logger;
};

export function createApi(options: ApiOptions) {
  const fetcher = options.fetch ?? (async (input, init) => fetch(input, init));
  async function request(
    path: string,
    init: RequestInit = {},
    authenticated = true,
  ): Promise<ApiResponse> {
    const started = Date.now();
    let status: number | undefined;
    const headers = new Headers(init.headers);
    headers.set("accept", "application/json");
    const token = authenticated ? options.token?.() : undefined;
    if (token !== undefined) headers.set("authorization", `Bearer ${token}`);
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), options.settings.timeoutMs);
    try {
      const response = await fetcher(path, {
        ...init,
        headers,
        credentials: "omit",
        redirect: "error",
        signal: init.signal
          ? AbortSignal.any([timeout.signal, init.signal])
          : timeout.signal,
      });
      status = response.status;
      if (status >= 400) {
        options.logger?.write("error", "api.response", { status });
      }
      const compatibility = response.headers.get(COMPATIBILITY_CHECK_HEADER);
      if (
        compatibility !== null &&
        Number(compatibility) !== COMPATIBILITY_CHECK
      ) {
        throw new ApiError(
          "Client/server versions differ; update the terminal client",
          409,
        );
      }
      if (
        response.status === 401 &&
        token !== undefined &&
        token === options.token?.()
      ) {
        options.onUnauthorized?.();
      }
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new ApiError("Server returned invalid JSON", response.status);
      }
      return { status: response.status, body, headers: response.headers };
    } catch (error) {
      if (!init.signal?.aborted) options.logger?.error("api.error", error);
      if (error instanceof ApiError || init.signal?.aborted) throw error;
      throw new TransportError(
        timeout.signal.aborted
          ? "Request timed out"
          : "Could not reach the server",
        error,
      );
    } finally {
      clearTimeout(timer);
      options.logger?.write("debug", "api.request", {
        method: init.method ?? "GET",
        status,
        durationMs: Date.now() - started,
      });
    }
  }
  const client = initClient(contract, {
    baseUrl: options.settings.apiUrl,
    jsonQuery: true,
    api: async (args) => {
      const metadata = args.route.metadata as EndpointMetadata | undefined;
      const response = await request(
        args.path,
        {
          ...args.fetchOptions,
          method: args.method,
          headers: args.headers,
          body: args.body,
        },
        metadata?.authenticationOptions?.isPublic !== true,
      );
      const schema = args.route.responses[response.status];
      if (isZodType(schema)) {
        const parsed = schema.safeParse(response.body);
        if (!parsed.success) {
          throw new ApiError("Server returned invalid data", response.status);
        }
        return { ...response, body: parsed.data };
      }
      return response;
    },
  });
  return {
    client,
    settings: options.settings,
    auth: async (
      path: string,
      body?: object,
      signal?: AbortSignal,
      authenticated = true,
      explicitToken?: string,
    ) =>
      request(
        `${options.settings.apiUrl}/auth${path}`,
        {
          method: body === undefined ? "GET" : "POST",
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          headers: {
            ...(body === undefined
              ? {}
              : { "content-type": "application/json" }),
            ...(explicitToken === undefined
              ? {}
              : { authorization: `Bearer ${explicitToken}` }),
          },
          signal,
        },
        authenticated,
      ),
  };
}
export type Api = ReturnType<typeof createApi>;
