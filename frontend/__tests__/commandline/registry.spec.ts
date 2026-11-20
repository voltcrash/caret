import { describe, expect, it } from "vite-plus/test";

import {
  contributedCommands,
  contributedList,
  registerCommands,
} from "../../src/ts/commandline/registry";

describe("command registry", () => {
  it("exposes a contribution's commands and lists until it is released", () => {
    const restart = { id: "restartTest", display: "Restart test" };
    const challenges = { title: "Load challenge...", list: [] };
    const release = registerCommands({
      commands: { result: [restart] },
      lists: { loadChallenge: challenges },
    });

    expect(contributedCommands("result")).toEqual([restart]);
    expect(contributedCommands("other")).toEqual([]);
    expect(contributedList("loadChallenge")).toBe(challenges);

    release();

    expect(contributedCommands("result")).toEqual([]);
    expect(contributedList("loadChallenge")).toBeUndefined();
  });

  it("keeps registration order within a slot", () => {
    const first = { id: "first", display: "first" };
    const second = { id: "second", display: "second" };
    const releaseFirst = registerCommands({ commands: { test: [first] } });
    const releaseSecond = registerCommands({ commands: { test: [second] } });

    expect(contributedCommands("test")).toEqual([first, second]);

    releaseFirst();
    releaseSecond();
  });
});
