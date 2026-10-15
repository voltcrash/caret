import "@tanstack/solid-start/server-only";

/** Preserve the legacy 100 KiB ceiling without parsing Better Auth's payload. */
export async function boundedRequest(
  request: Request,
): Promise<Request | Response> {
  const limit = 100 * 1024;
  if (Number(request.headers.get("content-length")) > limit) {
    return new Response("Request body too large", { status: 413 });
  }
  if (request.body === null) return request;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > limit) {
      await reader.cancel();
      return new Response("Request body too large", { status: 413 });
    }
    chunks.push(value);
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Request(request, { body });
}
