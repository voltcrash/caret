import { createAppOwned } from "../../app/application";
const checks = createAppOwned(() => new Set<() => boolean>());

// Components retain ownership of their nodes, including the closing animation.
export function registerOverlayVisibility(check: () => boolean): () => void {
  const visibilityChecks = checks();
  visibilityChecks.add(check);
  return () => visibilityChecks.delete(check);
}

export function isAnyPopupVisible(): boolean {
  return [...checks()].some((check) => check());
}
