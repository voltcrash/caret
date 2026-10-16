import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { toJSONAsync } from "seroval";
import { rpcPath } from "./rpc";
import {
  createWorkerd,
  enableConfiguration,
  seedLeaderboard,
  seedProfile,
  seedSession,
} from "./workerd";

const origin = "http://localhost:3000";

describe("native public routes in workerd", () => {
  let mf: Awaited<ReturnType<typeof createWorkerd>>;
  beforeAll(async () => {
    mf = await createWorkerd();
    await enableConfiguration(mf, "a", "$.users.profiles", { enabled: true });
    await seedProfile(mf, "a", "ssr-profile");
    await seedLeaderboard(mf, "a", 60);
  });
  afterAll(async () => await mf?.dispose());

  it("server-renders a public profile with route metadata", async () => {
    const worker = await mf.getWorker("a");
    const response = await worker.fetch(`${origin}/profile/ssr-profile`);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const html = await response.text();
    expect(html).toContain("ssr-profile | Oxytype");
    expect(html).toContain("https://oxytype.voltcrash.com/profile/ssr-profile");
    expect(html).toContain("ssr-profile public bio");
    expect(html).toContain('aria-label="Profile summary"');
    // Only the public DTO is serialized; never account credentials.
    expect(html).not.toContain("profile-ssr-profile@example.test");
  });

  it("returns 404 for unknown profiles and renders the missing message", async () => {
    const worker = await mf.getWorker("a");
    const response = await worker.fetch(`${origin}/profile/nobody-here`);
    expect(response.status).toBe(404);
    expect(await response.text()).toContain("User nobody-here not found");
  });

  it("keeps configuration gates: disabled profiles degrade inline", async () => {
    const worker = await mf.getWorker("b");
    const response = await worker.fetch(`${origin}/profile/anyone`, {
      headers: { "cf-connecting-ip": "192.0.2.42" },
    });
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).not.toContain("Profile summary");
    expect(html).not.toContain("Profiles are not available");
    const db = await mf.getD1Database("DB", "b");
    expect(
      await db
        .prepare(
          "SELECT points FROM rate_counters WHERE key='rate:root:192.0.2.42'",
        )
        .first<number>("points"),
    ).toBe(1);
  });

  it("renders the profile lookup shell", async () => {
    const response = await mf.dispatchFetch(`${origin}/profile`);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("Profile Search | Oxytype");
    expect(html).toContain("Profile lookup");
  });

  it("server-renders the requested leaderboard page from validated search", async () => {
    const worker = await mf.getWorker("a");
    const first = await worker.fetch(`${origin}/leaderboards`);
    expect(first.status).toBe(200);
    const html = await first.text();
    expect(html).toContain("Leaderboards | Oxytype");
    expect(html).toContain("All-time english time 15 leaderboard");
    expect(html).toContain("racer-1<");
    expect(html).not.toContain("racer-51<");
    const second = await worker.fetch(
      `${origin}/leaderboards?type=allTime&mode2=15&page=2`,
    );
    const page2 = await second.text();
    expect(page2).toContain("racer-51<");
    expect(page2).not.toContain("racer-1<");
    // Invalid search is ignored like the old page URL parser.
    const invalid = await worker.fetch(`${origin}/leaderboards?type=hourly`);
    expect(invalid.status).toBe(200);
    expect(await invalid.text()).toContain("racer-1<");
  });

  it("validates direct profile/board RPCs and independently authorizes private ranks", async () => {
    const worker = await mf.getWorker("a");
    const call = async (
      name: string,
      data: unknown,
    ): Promise<Awaited<ReturnType<typeof worker.fetch>>> =>
      await worker.fetch(
        `${origin}${rpcPath(name)}?payload=${encodeURIComponent(JSON.stringify(await toJSONAsync({ data })))}`,
        { headers: { origin, "x-tsr-serverFn": "true" } },
      );
    expect(
      (
        await call("getProfile", {
          uidOrName: "ssr-profile",
          client: "invalid",
        })
      ).status,
    ).toBe(422);
    const selection = {
      type: "allTime",
      mode: "time",
      mode2: "15",
      language: "english",
      previous: false,
    };
    expect((await call("getLeaderboard", { selection, page: -1 })).status).toBe(
      422,
    );
    expect((await call("getLeaderboardRank", selection)).status).toBe(401);
    const board = await call("getLeaderboard", { selection, page: 1 });
    expect(board.status).toBe(200);
    expect(await board.text()).toContain("racer-51");
  });

  it("guards direct private documents and omits account history and credentials from SSR", async () => {
    const worker = await mf.getWorker("a");
    const guest = await worker.fetch(`${origin}/account?client=tui`, {
      redirect: "manual",
    });
    expect(guest.status).toBe(307);
    expect(guest.headers.get("location")).toContain(
      "/login?redirect=%2Faccount%3Fclient%3Dtui",
    );
    const session = await seedSession(mf, "a");
    const db = await mf.getD1Database("DB", "a");
    await db
      .prepare(
        "INSERT INTO users(uid,id,name,name_key,email,added_at,data) VALUES(?,?,?,?,?,0,?)",
      )
      .bind(
        session.uid,
        session.uid,
        "private-route",
        "private-route",
        "private-route@example.test",
        JSON.stringify({
          uid: session.uid,
          privateHistoryMarker: "never-serialize-history",
        }),
      )
      .run();
    const account = await worker.fetch(`${origin}/account?client=tui`, {
      headers: { cookie: session.cookie },
    });
    expect(account.status).toBe(200);
    expect(account.headers.get("Cache-Control")).toBe("no-store");
    const html = await account.text();
    expect(html).toContain("Account | Oxytype");
    expect(html).not.toContain(session.token);
    expect(html).not.toContain("never-serialize-history");
    const alias = await worker.fetch(`${origin}/account-settings?source=mail`, {
      headers: { cookie: session.cookie },
      redirect: "manual",
    });
    expect(alias.status).toBe(307);
    expect(alias.headers.get("location")).toContain(
      "/settings?tab=account&source=mail",
    );
  });
});
