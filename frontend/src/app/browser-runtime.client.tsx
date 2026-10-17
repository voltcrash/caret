import { AccountRuntime } from "../features/account/runtime.client";
import { AnnouncementsRuntime } from "../features/announcements/runtime.client";
import { AuthRuntime } from "../features/auth/runtime.client";
import { UpdateRuntime } from "../features/update/runtime.client";
import PlatformRuntime from "./platform-runtime.client";
/** Browser integrations owned by the application root; removed with it. */
export default function BrowserRuntime() {
  return (
    <>
      <PlatformRuntime />
      <AuthRuntime />
      <AccountRuntime />
      <UpdateRuntime />
      <AnnouncementsRuntime />
    </>
  );
}
