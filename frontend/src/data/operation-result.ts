/**
 * A web operation's outcome. Expected failures (auth, limits, validation,
 * service errors) are values with their legacy status and message, so callers
 * keep their error UX without depending on a transport's error channel.
 */
export type OperationResult<T> =
  | { ok: true; status: 200; message: string; data: T }
  | {
      ok: false;
      status: number;
      message: string;
      validationErrors?: string[];
    };
