export function checkAuthResult<T>(result: {
  data: T;
  error: { message?: string } | null;
}): T {
  if (result.error !== null) {
    throw new Error(result.error.message ?? "Authentication failed");
  }
  return result.data;
}
