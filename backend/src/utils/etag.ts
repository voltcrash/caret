import { createHash } from "node:crypto";
import { COMPATIBILITY_CHECK } from "@oxytype/contracts";

/**
 * create etag generator, matching the `etag` package used by express https://github.com/jshttp/etag/blob/v1.8.1/index.js#L39
 * Adds the api COMPATIBILITY_CHECK version in front of the etag.
 * @param options
 * @returns
 */
export function createETagGenerator(options: {
  weak: boolean;
}): (body: Buffer | string, encoding: BufferEncoding | undefined) => string {
  return function generateETag(body, encoding) {
    const buf = !Buffer.isBuffer(body) ? Buffer.from(body, encoding) : body;
    const hash = createHash("sha1").update(buf).digest("base64").slice(0, 27);
    const tag = `V${COMPATIBILITY_CHECK}-${buf.length.toString(16)}-${hash}"`;

    return options.weak ? `W/"${tag}` : `"${tag}`;
  };
}
