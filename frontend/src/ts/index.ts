// Opt-in instrumentation registers before application signals are created.
import "virtual:devtools";

import { init } from "./auth-client";
import * as Logger from "./utils/logger";
import * as DB from "./db";
import { Config } from "./config/store";
import * as TestTimer from "./test/test-timer";
import { onAuthStateChanged } from "./auth";
import { enable } from "./states/glarses-mode";
import "./states/connection";
import "./test/tts";
import { addToGlobal } from "./utils/misc";
import * as Focus from "./test/focus";
import { fetchLatestVersion } from "./utils/version";
import * as Sentry from "./sentry";
import * as Cookies from "./cookies";
import "./elements/psa";
import "./controllers/url-handler";
import { applyEngineSettings } from "./anim";
import { render } from "solid-js/web";
import { lockMath } from "../app/browser-integrity";
import { AppRouter } from "./components/AppRouter";
import { setVersion } from "./states/core";
import { loadFromLocalStorage } from "./config/lifecycle";

import { getLastEventLog } from "./states/test";
import { buildEventLog } from "./test/events/data";

lockMath();
applyEngineSettings();
void loadFromLocalStorage();
void fetchLatestVersion().then((data) => {
  if (data === null) return;
  setVersion(data);
});

Focus.set(true, true);
const accepted = Cookies.getAcceptedCookies();
void init(onAuthStateChanged).then(() => {
  if (accepted !== null) {
    Cookies.activateWhatsAccepted();
  }
});

addToGlobal({
  snapshot: DB.getSnapshot,
  config: Config,
  glarsesMode: enable,
  enableTimerDebug: TestTimer.enableTimerDebug,
  toggleSmoothedBurst: async () => {
    const Result = await import("./test/result");
    Result.toggleSmoothedBurst();
  },
  toggleDebugLogs: Logger.toggleDebugLogs,
  toggleSentryDebug: Sentry.toggleDebug,
  lastEventLog: () => getLastEventLog(),
  currentEventLog: buildEventLog,
});

const appElement = document.getElementById("app");
if (!appElement) throw new Error("App mount not found");
render(
  () =>
    AppRouter({
      element: appElement,
      body: document.body as HTMLBodyElement,
      noCssWarning: document.getElementById("nocss"),
    }),
  appElement,
);
