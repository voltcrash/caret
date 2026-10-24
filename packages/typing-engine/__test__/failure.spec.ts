import { expect, it } from "vite-plus/test";
import { EngineFailure, disposed, invoke } from "../src/failure";
it("decodes the native structured error envelope without interpreting messages", () => {
  const detail = {
    code: "onePolyglotLanguage" as const,
    message: "",
    recovery: [
      { op: "setLanguage" as const, language: "english", noSave: true },
      { op: "disableFunbox" as const, name: "polyglot", noRestart: true },
    ],
  };
  const cause = new Error(JSON.stringify(detail));
  try {
    invoke(() => {
      throw cause;
    });
    throw new Error("Expected failure");
  } catch (error) {
    expect(error).toBeInstanceOf(EngineFailure);
    expect(error).toMatchObject({
      code: detail.code,
      message: "",
      recovery: detail.recovery,
      cause,
    });
  }
});
it("preserves typed disposal and wraps host serialization errors as invalid input", () => {
  const error = disposed("Session disposed");
  expect(() =>
    invoke(() => {
      throw error;
    }),
  ).toThrow(error);
  let caught: unknown;
  try {
    invoke(() => JSON.stringify(1n));
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(EngineFailure);
  expect(caught).toMatchObject({ code: "invalidInput", recovery: [] });
  expect(invoke(() => 7)).toBe(7);
});
