import { AccountRuntime } from "../features/account/runtime.client";
import { AnnouncementsRuntime } from "../features/announcements/runtime.client";
import { AuthRuntime } from "../features/auth/runtime.client";
import { UpdateRuntime } from "../features/update/runtime.client";

/** Account/network work starts after the first route can accept input. */
export default function BackgroundRuntime() {
  return (
    <>
      <AuthRuntime />
      <AccountRuntime />
      <UpdateRuntime />
      <AnnouncementsRuntime />
    </>
  );
}
