import { expect, it } from "vite-plus/test";
import { mountApplication } from "../../src/app/application";
import {
  createTestApplication,
  releaseTestApplication,
} from "../__harness__/mock-application";

releaseTestApplication();
it("imports palette definitions without an app and recreates its mutable tree on remount", async () => {
  const lists = await import("../../src/ts/commandline/lists");
  const { commandlineState } = await import("../../src/ts/states/commandline");
  const first = createTestApplication();
  const release = mountApplication(first.application);
  lists.setStackToDefault();
  const tree = lists.getTopOfStack();
  commandlineState.inputValue = "old search";
  tree.title = "old app";
  first.dispose();
  release();
  const next = createTestApplication();
  const releaseNext = mountApplication(next.application);
  lists.setStackToDefault();
  expect(lists.getTopOfStack()).not.toBe(tree);
  expect(lists.getTopOfStack().title).toBe("");
  expect(commandlineState.inputValue).toBe("");
  next.dispose();
  releaseNext();
});
