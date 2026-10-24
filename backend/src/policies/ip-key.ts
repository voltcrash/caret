import { isIP } from "net";

/** Canonical (RFC 5952) form via the WHATWG URL host serializer. */
function canonicalIPv6(ip: string): string {
  return new URL(`http://[${ip}]`).hostname.slice(1, -1);
}

function expandIPv6(ip: string): number[] {
  const [head = "", tail] = canonicalIPv6(ip).split("::");
  const parse = (part: string): number[] =>
    part === "" ? [] : part.split(":").map((group) => parseInt(group, 16));
  const left = parse(head);
  const right = tail === undefined ? [] : parse(tail);
  return [
    ...left,
    ...Array<number>(8 - left.length - right.length).fill(0),
    ...right,
  ];
}

export function getIpKey(ip: string): string {
  if (isIP(ip) !== 6) return ip;
  // Key IPv6 clients by their /56 prefix: three groups plus one byte.
  const groups = expandIPv6(ip.split("%")[0] ?? ip).map((group, i) =>
    i < 3 ? group : i === 3 ? group & 0xff00 : 0,
  );
  return `${canonicalIPv6(groups.map((group) => group.toString(16)).join(":"))}/56`;
}
