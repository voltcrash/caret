import { AuthRuntime } from "../features/auth/runtime.client";
import PlatformRuntime from "./platform-runtime.client";
/** Native Start owner. Rollback imports only platform-runtime. */
export default function BrowserRuntime() {
  return (
    <>
      <PlatformRuntime />
      <AuthRuntime />
    </>
  );
}
