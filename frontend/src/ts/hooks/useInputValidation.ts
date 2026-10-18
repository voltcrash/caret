import { debounce } from "throttle-debounce";
import "@oxytype/util/zod-messages";
import type { Validation, ValidationResult } from "../types/validation";

function debounceIfNeeded<A extends unknown[], R>(
  delay: number,
  callback: (...args: A) => R,
): ((...args: A) => R) | debounce<(...args: A) => R> {
  if (delay <= 0) {
    return callback;
  }
  return debounce(delay, callback);
}

/**
 * Create input handler for validated input element.
 * the `callback` is called for each validation state change, including "checking".
 * @param callback callback to call for each change of the validation status
 * @param validation validation options
 * @param inputValueConvert  convert method from string to the schema type, mandatory if the schema is not a string schema
 * @returns debounced input event handler
 */
export function useInputValidation<T>(
  callback: (result: ValidationResult) => void,
  validation: Validation<T>,
  inputValueConvert?: (val: string) => T,
  signal?: AbortSignal,
): (e: Event) => Promise<void> {
  let callIsValid =
    validation.isValid !== undefined
      ? debounceIfNeeded(
          validation.debounceDelay ?? 250,
          async (
            originalInput: HTMLInputElement,
            currentValue: string,
            checkValue: T,
          ) => {
            if (signal?.aborted) return;
            const result = await validation.isValid?.(checkValue);
            if (signal?.aborted) return;
            if (originalInput.value !== currentValue) {
              //value has change in the meantime, discard result
              return;
            }

            if (result === true) {
              callback({ status: "success", success: true });
            } else {
              if (typeof result === "object" && "warning" in result) {
                callback({
                  status: "warning",
                  errorMessage: result.warning,
                  success: false,
                });
              } else {
                callback({
                  status: "failed",
                  errorMessage: result,
                  success: false,
                });
              }
            }
          },
        )
      : undefined;

  signal?.addEventListener(
    "abort",
    () => {
      if (callIsValid !== undefined && "cancel" in callIsValid) {
        callIsValid.cancel();
      }
    },
    { once: true },
  );
  return async (e) => {
    if (signal?.aborted) return;
    const originalInput = e.target as HTMLInputElement;
    const currentValue = originalInput.value;
    let checkValue: unknown = currentValue;

    if (inputValueConvert !== undefined) {
      checkValue = inputValueConvert(currentValue);
    }

    callback({ status: "checking", success: false });

    if (validation.schema !== undefined) {
      const schemaResult = validation.schema.safeParse(checkValue);

      if (!schemaResult.success) {
        callback({
          success: false,
          status: "failed",
          errorMessage: `${schemaResult.error.issues
            .map((err) =>
              err.message.at(-1) === "."
                ? err.message.slice(0, -1)
                : err.message,
            )
            .join(", ")}.`,
        });
        return;
      }
    }

    if (callIsValid === undefined) {
      callback({ status: "success", success: true });
      //call original handler if defined
      originalInput.oninput?.(e as InputEvent);
      return;
    }

    await callIsValid(originalInput, currentValue, checkValue as T);
    //call original handler if defined
    originalInput.oninput?.(e as InputEvent);
  };
}
