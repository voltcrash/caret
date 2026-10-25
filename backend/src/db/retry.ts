const transientMessages = [
  "Network connection lost",
  "storage caused object to be reset",
  "reset because its code was updated",
];

/** Drizzle and D1 may wrap the original error in one or more causes. */
export function d1ErrorMessage(error: unknown): string {
  const messages: string[] = [];
  const seen = new Set<unknown>();
  let current = error;
  while (current !== undefined && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error) {
      messages.push(current.message);
      current = current.cause;
    } else {
      if (typeof current === "string") messages.push(current);
      break;
    }
  }
  return messages.join(" ");
}

export function isTransientD1Error(error: unknown): boolean {
  const message = d1ErrorMessage(error);
  return transientMessages.some((text) => message.includes(text));
}

/** Opt-in only: callers must make replay safe, including lost acknowledgements. */
export async function retryIdempotentD1Write<T>(
  write: () => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await write();
    } catch (error) {
      if (attempt >= 3 || !isTransientD1Error(error)) throw error;
      // Bounded exponential full jitter: at most 100 + 200 + 400 ms waiting.
      await new Promise<void>((resolve) => {
        setTimeout(resolve, Math.floor(Math.random() * 100 * 2 ** attempt));
      });
    }
  }
}
