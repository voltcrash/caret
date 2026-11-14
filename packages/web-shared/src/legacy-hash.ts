/**
 * Legacy result wire format: sorted object keys, ordered arrays, prototype
 * markers and UTF-16 string lengths, SHA-1 over UTF-8 bytes. This is an identity
 * checksum, not authentication. Do not change without versioning stored hashes.
 * Serialization follows object-hash 3.0.0 (MIT; see legacy-hash.LICENSE).
 */
export function legacyHash(input: object): string {
  const context: unknown[] = [];
  const chunks: string[] = [];
  function dispatch(value: unknown): void {
    if (value === null) {
      chunks.push("Null");
      return;
    }
    switch (typeof value) {
      case "undefined":
        chunks.push("Undefined");
        return;
      case "string":
        chunks.push(`string:${value.length}:`, value);
        return;
      case "number":
        chunks.push(`number:${value.toString()}`);
        return;
      case "boolean":
        chunks.push(`bool:${value.toString()}`);
        return;
      case "object":
        break;
      case "function":
        // Plain result objects inherit Object's native constructor.
        if (value !== Object) {
          throw new TypeError("Unsupported result function");
        }
        chunks.push("fn:");
        dispatch("[native]");
        dispatch("function-name:Object");
        break;
      default:
        throw new TypeError("Unsupported result value");
    }
    const previous = context.indexOf(value);
    if (previous >= 0) {
      dispatch(`[CIRCULAR:${previous}]`);
      return;
    }
    context.push(value);
    if (Array.isArray(value)) {
      chunks.push(`array:${value.length}:`);
      value.forEach(dispatch);
      return;
    }
    if (value instanceof Date) {
      chunks.push(`date:${value.toJSON()}`);
      return;
    }
    const prototype: unknown = Object.getPrototypeOf(value);
    if (
      value !== Object &&
      prototype !== Object.prototype &&
      prototype !== null
    ) {
      throw new TypeError("Unsupported result object");
    }
    const keys = Object.keys(value).sort();
    if (value !== Object) keys.unshift("prototype", "__proto__", "constructor");
    chunks.push(`object:${keys.length}:`);
    for (const key of keys) {
      dispatch(key);
      chunks.push(":");
      dispatch(Reflect.get(value, key));
      chunks.push(",");
    }
  }
  dispatch(input);
  return sha1(new TextEncoder().encode(chunks.join("")));
}

function rotate(value: number, bits: number): number {
  return (value << bits) | (value >>> (32 - bits));
}

/** SHA-1, kept synchronous for the existing replay and signed-out callers. */
function sha1(input: Uint8Array): string {
  const bytes = new Uint8Array(Math.ceil((input.length + 9) / 64) * 64);
  bytes.set(input);
  bytes[input.length] = 0x80;
  const view = new DataView(bytes.buffer);
  view.setUint32(bytes.length - 8, Math.floor(input.length / 0x20000000));
  view.setUint32(bytes.length - 4, input.length * 8);
  let h0 = 0x67452301,
    h1 = 0xefcdab89,
    h2 = 0x98badcfe,
    h3 = 0x10325476,
    h4 = 0xc3d2e1f0;
  const words = new Int32Array(80);
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let i = 0; i < 16; i++) words[i] = view.getInt32(offset + i * 4);
    for (let i = 16; i < 80; i++) {
      words[i] = rotate(
        (words[i - 3] ?? 0) ^
          (words[i - 8] ?? 0) ^
          (words[i - 14] ?? 0) ^
          (words[i - 16] ?? 0),
        1,
      );
    }
    let a = h0,
      b = h1,
      c = h2,
      d = h3,
      e = h4;
    for (let i = 0; i < 80; i++) {
      const f =
        i < 20
          ? (b & c) | (~b & d)
          : i < 40
            ? b ^ c ^ d
            : i < 60
              ? (b & c) | (b & d) | (c & d)
              : b ^ c ^ d;
      const k =
        i < 20
          ? 0x5a827999
          : i < 40
            ? 0x6ed9eba1
            : i < 60
              ? 0x8f1bbcdc
              : 0xca62c1d6;
      const temp = (rotate(a, 5) + f + e + k + (words[i] ?? 0)) | 0;
      e = d;
      d = c;
      c = rotate(b, 30);
      b = a;
      a = temp;
    }
    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
  }
  return [h0, h1, h2, h3, h4]
    .map((word) => (word >>> 0).toString(16).padStart(8, "0"))
    .join("");
}
