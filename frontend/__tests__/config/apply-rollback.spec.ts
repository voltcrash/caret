import { createComputed, createRoot } from "solid-js";
import { expect, it, vi } from "vite-plus/test";

import { applyConfig } from "../../src/ts/config/lifecycle";
import { setConfig } from "../../src/ts/config/setters";
import { getConfig } from "../../src/ts/config/store";

// Browser module exports are sealed; register spies before imports run.
vi.mock("../../src/ts/config/setters", { spy: true });

it("rolls back a failed full load and keeps reactive readers live", async () => {
  setConfig("punctuation", true, { nosave: true });
  const seen: boolean[] = [];
  const dispose = createRoot((dispose) => {
    createComputed(() => seen.push(getConfig.punctuation));
    return dispose;
  });
  vi.mocked(setConfig).mockImplementationOnce(() => {
    throw new Error("apply failed");
  });

  // Resetting to defaults changes punctuation before the failure.
  await expect(applyConfig({ punctuation: false })).rejects.toThrow(
    "apply failed",
  );
  expect(getConfig.punctuation).toBe(true);

  setConfig("punctuation", false, { nosave: true });
  expect(seen.at(-1)).toBe(false);
  dispose();
});
