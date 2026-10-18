import "@tanstack/solid-start/server-only";
import { gunzipSync, inflateSync, brotliDecompressSync } from "node:zlib";

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
  // Better Auth owns its body/cookie protocol; never decode/rewrite its payload.
  if (new URL(request.url).pathname.startsWith("/api/auth/")) {
    return new Request(request, { body });
  }
  const charset = request.headers
    .get("content-type")
    ?.match(/charset=([^;]+)/i)?.[1]
    ?.replaceAll('"', "")
    .toLowerCase();
  if (charset !== undefined && charset !== "utf-8" && charset !== "utf8") {
    return new Response("Unsupported request charset", { status: 415 });
  }
  const encoding =
    request.headers.get("content-encoding")?.toLowerCase() ?? "identity";
  if (encoding === "identity") return new Request(request, { body });
  const decode = {
    gzip: gunzipSync,
    deflate: inflateSync,
    br: brotliDecompressSync,
  }[encoding];
  if (decode === undefined) {
    return new Response("Unsupported content encoding", { status: 415 });
  }
  try {
    const decoded = decode(body, { maxOutputLength: limit });
    const headers = new Headers(request.headers);
    headers.delete("content-encoding");
    headers.delete("content-length");
    return new Request(request, { headers, body: decoded });
  } catch (error) {
    const exceeded =
      error instanceof RangeError ||
      (error as NodeJS.ErrnoException).code === "ERR_BUFFER_TOO_LARGE";
    return new Response(
      exceeded ? "Request body too large" : "Invalid compressed request body",
      { status: exceeded ? 413 : 400 },
    );
  }
}
