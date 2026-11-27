/** Only local URLs can receive an auth redirect; preserve search/hash. */
export function authRedirect(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    // URL parsing drops tab/newline/controls, so `/\t/x` would become `//x`.
    /[\x00-\x1f\x7f\\]/.test(value)
  ) {
    return "/";
  }
  return value;
}
