import { expect, it, vi } from "vite-plus/test";
import {
  captureTypingMount,
  mountTypingScope,
} from "../../../src/features/typing/scope";
import { setup } from "../../../src/ts/controllers/challenge-controller";
import { setConfig } from "../../../src/ts/config/setters";
import { getLoadedChallenge } from "../../../src/ts/states/test";

vi.mock("../../../src/ts/config/setters", () => ({ setConfig: vi.fn() }));
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
