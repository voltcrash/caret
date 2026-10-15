/** CF supplies the edge header; forwarded addresses are trusted only in dev. */
export function clientIp(
  headers: Headers,
  development: boolean,
  remoteAddress?: string,
): string {
  const candidates = [
    headers.get("cf-connecting-ip"),
    development
      ? headers.get("x-forwarded-for")?.split(",").pop()?.trim()
      : undefined,
    remoteAddress,
  ];
  return (
    candidates.find((ip) => ip !== undefined && ip !== null && ip !== "") ??
    "255.255.255.255"
  );
}
