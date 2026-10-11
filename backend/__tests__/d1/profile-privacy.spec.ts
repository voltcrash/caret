import { afterAll, beforeAll, expect, it } from "vite-plus/test";
import { createTestRuntime, seedUser } from "./helpers";
import { withRuntime } from "../../src/runtime/env";
import { getProfile, updateProfile } from "../../src/api/controllers/user";
import * as UserDAL from "../../src/dal/user";

let test: Awaited<ReturnType<typeof createTestRuntime>>;
const uid = "profile-privacy";
beforeAll(async () => {
  test = await createTestRuntime();
  await seedUser(test.env, uid);
});
afterAll(async () => await test?.dispose());

it("persists both privacy values and applies them to public profile reads", async () => {
  await withRuntime(test.env, async () => {
    for (const showActivityOnPublicProfile of [true, false]) {
      const response = await updateProfile({
        body: { showActivityOnPublicProfile },
        ctx: { decodedToken: { uid } },
      } as unknown as Parameters<typeof updateProfile>[0]);
      expect(response.data.showActivityOnPublicProfile).toBe(
        showActivityOnPublicProfile,
      );
      expect(
        (await UserDAL.getUser(uid, "privacy saved")).profileDetails
          ?.showActivityOnPublicProfile,
      ).toBe(showActivityOnPublicProfile);
      const profile = await getProfile({
        params: { uidOrName: uid },
        query: { isUid: true },
      } as unknown as Parameters<typeof getProfile>[0]);
      expect("testActivity" in profile.data).toBe(showActivityOnPublicProfile);
    }
  });
});

it("preserves privacy when omitted from a partial profile update", async () => {
  await withRuntime(test.env, async () => {
    await UserDAL.updateProfile(uid, { showActivityOnPublicProfile: true });
    await UserDAL.updateProfile(uid, { bio: "Updated bio" });
    expect(
      (await UserDAL.getUser(uid, "partial privacy")).profileDetails,
    ).toMatchObject({
      bio: "Updated bio",
      showActivityOnPublicProfile: true,
    });
  });
});
