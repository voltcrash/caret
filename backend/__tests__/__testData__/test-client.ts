import qs from "qs";

import { unitRuntime } from "../setup-tests";

type Handler = (request: Request) => Promise<Response>;

export type TestResponse = {
  status: number;
  /** Lowercase header names; `set-cookie` is an array. */
  headers: Record<string, string | string[]>;
  /** Content type without parameters. */
  type: string;
  text: string;
  // oxlint-disable-next-line no-explicit-any -- assertions read arbitrary JSON
  body: any;
};

/**
 * Supertest-style request builder over a fetch handler. Sends lazily on await;
 * every `expect(status)` is asserted against the response.
 */
export class TestRequest implements PromiseLike<TestResponse> {
  private readonly headers = new Headers();
  private readonly queryValues: Record<string, unknown> = {};
  private payload: string | undefined;
  private readonly expectedStatuses: number[] = [];
  private response: Promise<TestResponse> | undefined;
  private readonly handler: Handler;
  private readonly method: string;
  private readonly path: string;

  constructor(handler: Handler, method: string, path: string) {
    this.handler = handler;
    this.method = method;
    this.path = path;
  }

  set(name: string | Record<string, string>, value?: string): this {
    const entries: [string, string][] =
      typeof name === "string" ? [[name, value ?? ""]] : Object.entries(name);
    for (const [key, item] of entries) {
      this.headers.set(key, item);
    }
    return this;
  }

  accept(type: string): this {
    return this.set("Accept", type);
  }

  query(values: Record<string, unknown>): this {
    Object.assign(this.queryValues, values);
    return this;
  }

  send(body?: unknown): this {
    if (body === undefined) return this;
    if (typeof body === "string") {
      this.payload = body;
      if (!this.headers.has("Content-Type")) {
        this.headers.set("Content-Type", "application/x-www-form-urlencoded");
      }
    } else {
      this.payload = JSON.stringify(body);
      if (!this.headers.has("Content-Type")) {
        this.headers.set("Content-Type", "application/json");
      }
    }
    return this;
  }

  expect(status: number): this {
    this.expectedStatuses.push(status);
    return this;
  }

  // oxlint-disable-next-line no-thenable -- awaited like supertest's Test
  async then<T = TestResponse, E = never>(
    onFulfilled?: ((value: TestResponse) => T | PromiseLike<T>) | null,
    onRejected?: ((reason: unknown) => E | PromiseLike<E>) | null,
  ): Promise<T | E> {
    this.response ??= this.run();
    return await this.response.then(onFulfilled, onRejected);
  }

  private async run(): Promise<TestResponse> {
    const query = qs.stringify(this.queryValues, {
      indices: false,
      strictNullHandling: true,
    });
    const url = `http://127.0.0.1${this.path}${
      query === "" ? "" : `${this.path.includes("?") ? "&" : "?"}${query}`
    }`;
    const request = new Request(url, {
      method: this.method,
      headers: this.headers,
      body: this.payload,
    });
    const response = await unitRuntime(async () => await this.handler(request));

    const headers: TestResponse["headers"] = {};
    response.headers.forEach((value, name) => {
      if (name !== "set-cookie") headers[name] = value;
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length > 0) headers["set-cookie"] = cookies;

    const text = await response.text();
    const type = (response.headers.get("content-type") ?? "")
      .split(";")[0]
      ?.trim() as string;
    let body: unknown = {};
    if (/[/+]json$/.test(type) && text !== "") body = JSON.parse(text);

    const result: TestResponse = {
      status: response.status,
      headers,
      type,
      text,
      body,
    };
    for (const expected of this.expectedStatuses) {
      if (result.status !== expected) {
        throw new Error(
          `expected ${expected}, got ${result.status} for ${this.method} ${this.path}: ${text}`,
        );
      }
    }
    return result;
  }
}

export type TestClient = Record<
  "get" | "post" | "put" | "patch" | "delete" | "head",
  (path: string) => TestRequest
>;

export function createTestClient(handler: Handler): TestClient {
  const method =
    (name: string) =>
    (path: string): TestRequest =>
      new TestRequest(handler, name, path);
  return {
    get: method("GET"),
    post: method("POST"),
    put: method("PUT"),
    patch: method("PATCH"),
    delete: method("DELETE"),
    head: method("HEAD"),
  };
}
