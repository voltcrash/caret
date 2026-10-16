import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import {
  createWorkerd,
  enableConfiguration,
  seedLeaderboard,
  seedProfile,
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
    const response = await worker.fetch(`${origin}/profile/anyone`);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).not.toContain("Profile summary");
    expect(html).not.toContain("Profiles are not available");
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
});
