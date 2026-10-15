import { JSXElement, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { envConfig } from "virtual:env-config";

import { AppProviders } from "../../app/providers";
import { createQueryClient } from "../../app/query-client";
import { getConfig } from "../config/store";
import { getActivePage } from "../states/core";
import { isFixingSkillIssue } from "../states/skill-issue";
import { getFocus } from "../states/test";
import { cn } from "../utils/cn";
import { Download } from "./common/Download";
import { FilePicker } from "./common/FilePicker";
import { AccountRuntime } from "./core/AccountRuntime";
import { AppEffects, AppElements } from "./core/AppEffects";
import { CustomBackground } from "./core/CustomBackground";
import { FunboxEffects } from "./core/FunboxEffects";
import { HotkeyEvents } from "./core/HotkeyEvents";
import { LinkPrefetch } from "./core/LinkPrefetch";
import { PageHead } from "./core/PageHead";
import { SkillIssue } from "./core/SkillIssue";
import { Theme } from "./core/Theme";
import { ThemeEvents } from "./core/ThemeEvents";
import { DevTools } from "./dev/DevTools";
import { Footer } from "./layout/footer/Footer";
import { Header } from "./layout/header/Header";
import { Overlays } from "./layout/overlays/Overlays";
import { PageScroller } from "./layout/PageScroller";
import { Modals } from "./modals/Modals";
import { AppPages } from "./pages/AppPages";
import { BarTimerProgress } from "./pages/test/live-stats/BarTimerProgress";
import { MonkeyPower } from "./pages/test/MonkeyPower";
import { Popups } from "./popups/Popups";

export function App(props: AppElements): JSXElement {
  return (
    <AppProviders
      queryClient={createQueryClient({
        staleTime: 0,
        retry: envConfig.devOffline ? false : 3,
      })}
    >
      <Portal mount={props.body}>
        <AccountRuntime />
        <PageHead />
        <AppEffects {...props} />
        <Theme />
        <ThemeEvents />
        <HotkeyEvents />
        <LinkPrefetch />
      </Portal>
      <Show
        when={!isFixingSkillIssue()}
        fallback={
          <Portal mount={props.body}>
            <SkillIssue />
          </Portal>
        }
      >
        <Portal mount={props.body}>
          <Download />
          <FilePicker />
          <Overlays />
          <CustomBackground />
          <FunboxEffects />
          <BarTimerProgress />
          <div id="solidmodals">
            <Modals />
          </div>
          <div id="solidpopups">
            <Popups />
          </div>
          <DevTools />
          <Show when={getConfig.monkeyPowerLevel !== "off"}>
            <MonkeyPower />
          </Show>
        </Portal>
        <Header />
        <PageScroller>
          <main
            class={cn("full-width content-grid h-full", getFocus() && "focus")}
          >
            <AppPages />
          </main>
          <Show when={getActivePage() !== "settings"}>
            <Footer />
          </Show>
        </PageScroller>
      </Show>
    </AppProviders>
  );
}
