import { expect, it, vi } from "vite-plus/test";
import {
  captureTypingMount,
  mountTypingScope,
} from "../../../src/features/typing/scope";
import {
  setup,
  verify,
} from "../../../src/ts/controllers/challenge-controller";
import { setConfig } from "../../../src/ts/config/setters";
import {
  getLoadedChallenge,
  setLoadedChallenge,
} from "../../../src/ts/states/test";
import { browserAudit } from "../../__harness__/browser-audit";
import type { Challenge } from "@oxytype/challenges";
import type { CompletedEvent } from "@oxytype/schemas/results";

vi.mock("../../../src/ts/config/setters", () => ({ setConfig: vi.fn() }));
// Reuse the real browser audit module while controlling the route lifecycle.
vi.mock("../../../src/features/typing/audit.client", () => ({
  getBrowserAudit: () => ({ load: async () => browserAudit }),
}));
vi.mock("@oxytype/challenges", () => ({
  getChallenge: () => ({
    name: "oneHourWarrior",
    display: "Fixture",
    settings: { type: "script", parameters: { script: "fixture.txt" } },
  }),
}));

it("does not apply a script challenge after its typing route has left", async () => {
  let resolve!: (response: Response) => void;
  const fetch = vi.fn(
    async () =>
      new Promise<Response>((done) => {
        resolve = done;
      }),
  );
  vi.stubGlobal("fetch", fetch);
  const leave = mountTypingScope();
  captureTypingMount().activate();
  try {
    const result = setup("oneHourWarrior");
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    leave();
    resolve(new Response("hello world"));
    expect(await result).toBe(false);
    expect(setConfig).toHaveBeenCalledExactlyOnceWith("funbox", []);
    expect(getLoadedChallenge()).toBeNull();
  } finally {
    leave();
    vi.unstubAllGlobals();
  }
});

it("verifies results with the Rust challenge rules", async () => {
  const challenge = {
    name: "oneHourWarrior",
    display: "Fixture",
    description: "",
    category: "endurance",
    settings: {
      type: "customTime",
      parameters: { time: 3600 },
      requirements: { time: { min: 3600 }, config: { tapeMode: "off" } },
    },
  } satisfies Challenge;
  const result = {
    wpm: 80,
    acc: 98,
    rawWpm: 82,
    consistency: 70,
    afkDuration: 0,
    testDuration: 3600,
    funbox: [],
  } as unknown as CompletedEvent;
  setLoadedChallenge(challenge);
  try {
    expect(await verify(result)).toBe("oneHourWarrior");
    expect(await verify({ ...result, testDuration: 1800 })).toBeNull();
  } finally {
    setLoadedChallenge(null);
  }
});
