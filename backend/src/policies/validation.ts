import type { z } from "zod";
import { type AppRoute, checkZodSchema } from "@ts-rest/core";

type ZodIssue = z.core.$ZodIssue;

export type ValidationFailure = {
  message: string;
  validationErrors: string[];
};

export type InputValidation =
  | {
      success: true;
      input: { params: unknown; query: unknown; body: unknown };
    }
  | ({ success: false } & ValidationFailure);

/**
 * Contract input validation shared by every transport, with the legacy HTTP
 * messages and per-field error strings. Query values are already decoded.
 */
export function validateOperationInput(
  route: AppRoute,
  raw: { params: unknown; query: unknown; body: unknown; headers?: unknown },
): InputValidation {
  const params = checkZodSchema(raw.params, route.pathParams, {
    passThroughExtraKeys: true,
  });
  const headers = checkZodSchema(raw.headers ?? {}, route.headers, {
    passThroughExtraKeys: true,
  });
  const query = checkZodSchema(raw.query, route.query);
  const body = checkZodSchema(raw.body, "body" in route ? route.body : null);
  for (const [result, message] of [
    [params, "Invalid path parameter schema"],
    [query, "Invalid query schema"],
    [body, "Invalid request data schema"],
    [headers, "Invalid header schema"],
  ] as const) {
    if (!result.success) {
      return {
        success: false,
        message,
        validationErrors: result.error.issues
          .flatMap(formatValidationIssue)
          .map(
            (issue) =>
              `${issue.path.length > 0 ? `"${issue.path.join(".")}" ` : ""}${issue.message}`,
          ),
      };
    }
  }
  if (!params.success || !query.success || !body.success) {
    throw new Error("Unrecognized contract validation failure");
  }
  return {
    success: true,
    input: { params: params.data, query: query.data, body: body.data },
  };
}

// Codes that made Zod 3 abort a union branch instead of marking it dirty.
const abortingCodes = new Set<ZodIssue["code"]>([
  "invalid_type",
  "invalid_value",
  "invalid_union",
  "invalid_key",
  "invalid_element",
]);

// Zod 3 reported the first union branch whose type matched but whose checks
// failed (e.g. a too-long optional string next to a `""` literal). Zod 4
// reports the union itself, so unwrap to keep the API's validation errors.
function formatValidationIssue(issue: ZodIssue): ZodIssue[] {
  if (issue.code === "invalid_union") {
    const branches: ZodIssue[][] = issue.errors;
    const dirty = branches.find(
      (branch) =>
        branch.length > 0 &&
        branch.every((branchIssue) => !abortingCodes.has(branchIssue.code)),
    );
    if (dirty !== undefined) {
      // Union branch issues are relative to the union.
      return dirty.flatMap((branchIssue) =>
        formatValidationIssue({
          ...branchIssue,
          path: [...issue.path, ...branchIssue.path],
        }),
      );
    }
  }
  return [issue];
}
