import "../../__harness__/native-engine";
import { describe, expect, it } from "vite-plus/test";
import { analyzeLog } from "@caret/typing-engine/browser.client";
import { decodeText } from "@caret/typing-engine/text";
import cases from "../../../../packages/typing-fixtures/oracle/inspection.json" with { type: "json" };
import type { Log } from "@caret/typing-engine/browser.client";

describe("historical log inspection through optimized browser Wasm", () => {
  it.for(cases)("$name", (reference) => {
    const result = analyzeLog(reference.log as Log, {
      op: "inspect",
    }).inspection;
    expect({ ...result, inputs: result.inputs.map(decodeText) }).toEqual(
      reference.expected,
    );
  });
});
