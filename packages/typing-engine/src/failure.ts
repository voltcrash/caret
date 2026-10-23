import type { EngineError } from "../generated/types/EngineError";
import type { ErrorCode } from "../generated/types/ErrorCode";
import type { Recovery } from "../generated/types/Recovery";
export type { EngineError, ErrorCode, Recovery };

export class EngineFailure extends Error {
  readonly code: ErrorCode;
  readonly recovery: Recovery[];
  constructor(detail: EngineError, options?: ErrorOptions) {
    super(detail.message, options);
    this.name = "EngineFailure";
    this.code = detail.code;
    this.recovery = detail.recovery;
  }
}
/** All binding errors use the same JSON DTO as native callers. */
export function invoke<T>(operation: () => T): T {
  try {
    return operation();
  } catch (cause) {
    if (cause instanceof EngineFailure) throw cause;
    if (cause instanceof Error) {
      let detail: unknown;
      try {
        detail = JSON.parse(cause.message) as unknown;
      } catch {
        /* Host serialization errors are ordinary invalid input. */
      }
      if (
        detail !== null &&
        typeof detail === "object" &&
        "code" in detail &&
        typeof detail.code === "string" &&
        "message" in detail &&
        typeof detail.message === "string" &&
        "recovery" in detail &&
        Array.isArray(detail.recovery)
      ) {
        throw new EngineFailure(detail as EngineError, { cause });
      }
    }
    throw new EngineFailure(
      {
        code: "invalidInput",
        message: cause instanceof Error ? cause.message : String(cause),
        recovery: [],
      },
      { cause },
    );
  }
}
export function disposed(message: string): EngineFailure {
  return new EngineFailure({ code: "disposed", message, recovery: [] });
}
