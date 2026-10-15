import { requireApplication } from "../../../app/application";
export function baseKey(
  key: string,
  options?: { isUserSpecific?: true },
): unknown[] {
  if (!options?.isUserSpecific) return [key];
  const account = requireApplication().accountData;
  return ["user", account.actor(), account.capture().generation, key];
}
