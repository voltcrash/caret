import { describe, expect, it } from "vite-plus/test";

import { createAccountDataOwner } from "../../src/app/account-data";
import { createQueryClient } from "../../src/app/query-client";

describe("actor scope", () => {
  it("cancels private queries, clears data and replaces resources even on direct account switches", async () => {
    const client = createQueryClient({ retry: false, staleTime: 0 });
    const account = createAccountDataOwner(client);
    const disposed: string[] = [];
    account.setActor("a");
    const first = account.capture();
    account.scope().use(
      {},
      () => "a",
      (value) => disposed.push(value),
    );
    client.setQueryData(["public"], "public");
    const key = ["user", "a", first.generation, "history", "web"];
    let finish!: (value: string) => void;
    const request = client.query({
      queryKey: key,
      queryFn: async () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    });
    const cancelled = expect(request).rejects.toThrow();
    account.setActor("b");
    await cancelled;
    finish("late a");
    await Promise.resolve();
    expect(client.getQueryData(key)).toBeUndefined();
    expect(client.getQueryData(["public"])).toBe("public");
    expect(first.signal.aborted).toBe(true);
    expect(first.isCurrent()).toBe(false);
    expect(disposed).toEqual(["a"]);
    const second = account.capture();
    account.setActor("b");
    expect(account.capture().generation).toBe(second.generation);
    account.setActor(null);
    account.setActor("a");
    expect(account.capture().generation).toBeGreaterThan(first.generation);
    expect(() => first.assertCurrent()).toThrow("Account changed");
    const last = account.capture();
    account.dispose();
    expect(last.signal.aborted).toBe(true);
    client.clear();
  });
});
