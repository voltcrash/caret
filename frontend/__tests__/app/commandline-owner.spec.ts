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

it("drops private palette lists and ignores suggestions finishing after an actor change", async () => {
  const lists = await import("../../src/ts/commandline/lists");
  const { commandlineState } = await import("../../src/ts/states/commandline");
  const { showCommands } = await import("../../src/ts/commandline/suggestions");
  const app = createTestApplication();
  const release = mountApplication(app.application);
  app.application.accountData.setActor("actor-a");
  const tags = await lists.getList("tags");
  tags.list.push({ id: "private-tag", display: "private-a" });
  commandlineState.subgroupOverride = tags;
  const pending = showCommands();
  app.application.accountData.setActor("actor-b");
  await pending;
  expect(commandlineState.suggestions).toEqual([]);
  expect(commandlineState.subgroupOverride).toBeNull();
  expect((await lists.getList("tags")).list).toEqual([]);
  app.dispose();
  release();
});
