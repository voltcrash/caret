import { QueryClientProvider } from "@tanstack/solid-query";
import { JSXElement, Show } from "solid-js";
import { Portal } from "solid-js/web";

import { Config } from "../config/store";
import { queryClient } from "../queries";
import { getActivePage } from "../states/core";
import { isFixingSkillIssue } from "../states/skill-issue";
import { getFocus } from "../states/test";
import { cn } from "../utils/cn";
import { Download } from "./common/Download";
import { FilePicker } from "./common/FilePicker";
import { AppEffects, AppElements } from "./core/AppEffects";
import { CustomBackground } from "./core/CustomBackground";
import { FunboxEffects } from "./core/FunboxEffects";
import { LinkPrefetch } from "./core/LinkPrefetch";
import { PageHead } from "./core/PageHead";
import { SkillIssue } from "./core/SkillIssue";
import { Theme } from "./core/Theme";
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
    <QueryClientProvider client={queryClient}>
      <Portal mount={props.body}>
        <PageHead />
        <AppEffects {...props} />
        <Theme />
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
          <Show when={Config.monkeyPowerLevel !== "off"}>
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
    </QueryClientProvider>
  );
}
