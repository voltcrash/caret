/** Only local URLs can receive an auth redirect; preserve search/hash. */
export function authRedirect(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\r\n]/.test(value)
  ) {
    return "/";
  }
  return value;
}
