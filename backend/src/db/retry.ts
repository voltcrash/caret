/** Drizzle can wrap PostgreSQL errors in a cause. */
export function postgresError(
  error: unknown,
): { code: string; constraint?: string } | undefined {
  const seen = new Set<unknown>();
  let current = error;
  while (
    typeof current === "object" &&
    current !== null &&
    !seen.has(current)
  ) {
    seen.add(current);
    if ("code" in current && typeof current.code === "string") {
      return {
        code: current.code,
        ...("constraint" in current && typeof current.constraint === "string"
          ? { constraint: current.constraint }
          : {}),
      };
    }
    current = "cause" in current ? current.cause : undefined;
  }
  return undefined;
}
export function isTransientDatabaseError(error: unknown): boolean {
  const code = postgresError(error)?.code;
  return (
    code?.startsWith("08") === true ||
    ["40001", "40P01", "57P01", "57P02", "57P03"].includes(code ?? "") ||
    (error instanceof Error &&
      (/fetch failed|network|connection|Failed to fetch/i.test(error.message) ||
        (error.cause !== undefined && isTransientDatabaseError(error.cause))))
  );
}
/** Callers must make replay safe, including lost acknowledgements. */
export async function retryIdempotentWrite<T>(
  write: () => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await write();
    } catch (error) {
      if (attempt >= 3 || !isTransientDatabaseError(error)) throw error;
      await new Promise<void>((resolve) =>
        setTimeout(resolve, Math.floor(Math.random() * 100 * 2 ** attempt)),
      );
    }
  }
}
