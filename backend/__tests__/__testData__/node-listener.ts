import type { IncomingMessage, ServerResponse } from "node:http";

import { unitRuntime } from "../setup-tests";

/** Supertest drives Node listeners; adapt a fetch handler in the unit runtime. */
export function requestListener(
  handler: (request: Request) => Promise<Response>,
): (incoming: IncomingMessage, outgoing: ServerResponse) => Promise<void> {
  return async (incoming, outgoing) => {
    const chunks: Buffer[] = [];
    for await (const chunk of incoming) chunks.push(chunk as Buffer);
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      for (const item of [value].flat()) {
        if (item !== undefined) headers.append(name, item);
      }
    }
    const method = incoming.method ?? "GET";
    const request = new Request(
      `http://${incoming.headers.host ?? "localhost"}${incoming.url ?? "/"}`,
      {
        method,
        headers,
        body:
          method === "GET" || method === "HEAD"
            ? undefined
            : new Uint8Array(Buffer.concat(chunks)),
      },
    );
    const response = await unitRuntime(async () => await handler(request));
    outgoing.statusCode = response.status;
    if (response.statusText !== "") {
      outgoing.statusMessage = response.statusText;
    }
    response.headers.forEach((value, name) => {
      if (name !== "set-cookie") outgoing.setHeader(name, value);
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length > 0) outgoing.setHeader("set-cookie", cookies);
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  };
}
