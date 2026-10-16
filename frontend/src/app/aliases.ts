/** Former static build entries and extensionless HTML URLs → canonical routes. */
const aliases: Record<string, string> = {
  "/index.html": "/",
  "/index": "/",
  "/privacy-policy": "/privacy-policy.html",
  "/oauth-callback": "/oauth-callback.html",
  "/404": "/404.html",
};

/** Canonical href for an alias, keeping its query and hash; else undefined. */
export function canonicalHref(location: {
  pathname: string;
  searchStr: string;
  hash: string;
}): string | undefined {
  const target = aliases[location.pathname.replace(/(.)\/$/, "$1")];
  if (target === undefined) return undefined;
  return `${target}${location.searchStr}${location.hash === "" ? "" : `#${location.hash}`}`;
}

/** `/account-settings` → `/settings?tab=account`, with the original query overriding. */
export function accountSettingsHref(searchStr: string, hash: string): string {
  const target = new URLSearchParams("tab=account");
  new URLSearchParams(searchStr).forEach((value, key) => {
    target.set(key, value);
  });
  return `/settings?${target.toString()}${hash === "" ? "" : `#${hash}`}`;
}
