import { describe, expect, it } from "vite-plus/test";

import {
  pendingResultSaves,
  trackResultSave,
} from "../../src/app/update-safety";

describe("pending result saves", () => {
  it("counts concurrent saves until each settles, including failures", async () => {
    let resolve!: (value: string) => void;
    let reject!: (error: Error) => void;
    const first = trackResultSave(
      new Promise<string>((done) => {
        resolve = done;
      }),
    );
    const second = trackResultSave(
      new Promise<string>((_done, fail) => {
        reject = fail;
      }),
    );
    expect(pendingResultSaves()).toBe(2);
    resolve("saved");
    await expect(first).resolves.toBe("saved");
    expect(pendingResultSaves()).toBe(1);
    reject(new Error("lost acknowledgement"));
    await expect(second).rejects.toThrow("lost acknowledgement");
    expect(pendingResultSaves()).toBe(0);
  });
});
