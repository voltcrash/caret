const IPV4_LOOPBACK = /^127\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function isValidOctet(part: string): boolean {
  const value = Number(part);
  return Number.isInteger(value) && value >= 0 && value <= 255 && String(value) === part;
}

/**
 * MODE=dev trusts `Uid` auth, opens admin and development operations, and
 * reads X-Forwarded-For. Only loopback hosts may serve it so a misconfigured
 * deployment cannot expose development bypasses.
 */
export function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  if (normalized === "") return false;
  if (
    normalized === "localhost" ||
    normalized === "[::1]" ||
    normalized === "::1"
  ) {
    return true;
  }
  if (
    normalized.length > ".localhost".length &&
    normalized.endsWith(".localhost") &&
    !normalized.startsWith(".")
  ) {
    return true;
  }
  const match = IPV4_LOOPBACK.exec(normalized);
  if (match === null) return false;
  return (
    isValidOctet(match[1] ?? "") &&
    isValidOctet(match[2] ?? "") &&
    isValidOctet(match[3] ?? "")
  );
}

function parseAuthorityHostname(authority: string): string | null {
  const trimmed = authority.trim();
  if (trimmed === "" || /\s/.test(trimmed)) return null;
  try {
    const parsed = new URL(`http://${trimmed}`);
    if (
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.pathname !== "/" ||
      parsed.search !== "" ||
      parsed.hash !== ""
    ) {
      return null;
    }
    return parsed.hostname;
  } catch {
    return null;
  }
}

/**
 * Verify that a request entering MODE=dev targets a loopback host and does
 * not carry a non-loopback Host or Origin header. Fails closed on parse errors.
 */
export function isAllowedDevRequest(request: Request): boolean {
  let urlHostname: string;
  try {
    urlHostname = new URL(request.url).hostname;
  } catch {
    return false;
  }
  if (!isLoopbackHost(urlHostname)) return false;

  const hostHeader = request.headers.get("host");
  if (hostHeader !== null && hostHeader !== "") {
    const hostHostname = parseAuthorityHostname(hostHeader);
    if (hostHostname === null || !isLoopbackHost(hostHostname)) {
      return false;
    }
  }

  const originHeader = request.headers.get("origin");
  if (originHeader !== null && originHeader !== "") {
    let originHostname: string;
    try {
      originHostname = new URL(originHeader).hostname;
    } catch {
      return false;
    }
    if (!isLoopbackHost(originHostname)) return false;
  }

  return true;
}

/**
 * Return a fail-closed 403 response when MODE=dev receives a non-loopback
 * request; return undefined when the request is allowed.
 */
export function devModeViolationResponse(
  request: Request,
  mode: string | undefined,
): Response | undefined {
  if (mode !== "dev") return undefined;
  if (isAllowedDevRequest(request)) return undefined;
  return new Response("Development mode serves loopback hosts only", {
    status: 403,
    headers: { "Cache-Control": "no-store" },
  });
}
