import { AnyFieldApi } from "@tanstack/solid-form";
import type { z } from "zod";
import "@caret/util/zod-messages";

export type ValidationResult = { type: "error" | "warning"; message: string };
export function fromSchema<T, Input = T>(
  schema: z.ZodType<T>,
  options?: {
    convert?: (value: Input) => unknown;
  },
): (args: { value: Input }) => undefined | string[] {
  return ({ value }) => {
    const convertedValue = options?.convert?.(value) ?? value;
    const result = schema.safeParse(convertedValue);
    return result.success
      ? undefined
      : result.error.issues.map((it) => it.message);
  };
}

export function handleResult(
  field: AnyFieldApi,
  results: ValidationResult[] | undefined,
): undefined | string[] {
  if (results === undefined || results.length === 0) return undefined;

  const byType = Object.groupBy(results, (it) => it.type);

  if ((byType.warning?.length ?? 0) > 0) {
    field.setMeta((meta) => ({
      ...meta,
      hasWarning: true,
      warnings: byType.warning?.map((it) => it.message),
    }));
  }
  if ((byType.error?.length ?? 0) > 0) {
    return byType.error?.map((it) => it.message);
  }
  return undefined;
}

type ValidatorCallback<T> = (args: { value: T }) => string | undefined;

export function allFieldsMandatory<T extends object>(): ValidatorCallback<T> {
  return ({ value }: { value: T }): string | undefined => {
    const hasInvalid = Object.values(value).some(
      (v) => v === undefined || v === "",
    );

    return hasInvalid ? "all fields are mandatory" : undefined;
  };
}

export function fieldMandatory<T>(message?: string): ValidatorCallback<T> {
  return ({ value }) => {
    return value !== undefined && value !== ""
      ? undefined
      : (message ?? "mandatory");
  };
}
