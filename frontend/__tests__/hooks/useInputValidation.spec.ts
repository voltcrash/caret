import { describe, expect, it, vi } from "vite-plus/test";
import { z } from "zod";

import { useInputValidation } from "../../src/ts/hooks/useInputValidation";
import type {
  IsValidResponse,
  ValidationResult,
} from "../../src/ts/types/validation";

describe("useInputValidation", () => {
  it("reports a schema error without calling async validation", async () => {
    const callback = vi.fn<(result: ValidationResult) => void>();
    const isValid = vi.fn(async (): Promise<IsValidResponse> => true);
    const input = document.createElement("input");
    input.value = "oops";

    const handler = useInputValidation(
      callback,
      { schema: z.number(), isValid, debounceDelay: 0 },
      Number,
    );
    await handler({ target: input } as unknown as Event);

    expect(callback.mock.calls.map(([result]) => result.status)).toEqual([
      "checking",
      "failed",
    ]);
    expect(isValid).not.toHaveBeenCalled();
  });

  it("discards an async result after the input changes", async () => {
    const callback = vi.fn<(result: ValidationResult) => void>();
    let finishValidation: ((value: IsValidResponse) => void) | undefined;
    const isValid = vi.fn(async (): Promise<IsValidResponse> => {
      return new Promise((resolve) => (finishValidation = resolve));
    });
    const input = document.createElement("input");
    input.value = "first";

    const handler = useInputValidation(callback, {
      isValid,
      debounceDelay: 0,
    });
    const pending = handler({ target: input } as unknown as Event);
    input.value = "second";
    finishValidation?.(true);
    await pending;

    expect(callback.mock.calls.map(([result]) => result.status)).toEqual([
      "checking",
    ]);
  });
});
