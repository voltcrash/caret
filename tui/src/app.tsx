import { Dynamic, useRenderer } from "@opentui/solid";
import { untrack, createEffect, on, onCleanup, onMount } from "solid-js";

import type { ConfigStore } from "./config/store";
import type { ScreenId } from "./router/screens";

import { AccountContext, type Account } from "./account";
import { createAssetSource } from "./assets/source";
import { openBrowser } from "./auth/browser";
import { AuthContext, type AuthStore } from "./auth/store";
import { ConfigContext } from "./config/store";
import {
  createNotifications,
  NotificationsContext,
  type Notifications,
} from "./notifications";
import { rootCommands } from "./palette/commands";
import { createPalette, PaletteContext } from "./palette/palette";
import {
  createHistoryStore,
  HistoryContext,
  localPaceSpeed,
  type HistoryStore,
} from "./results/history";
import { UploadContext } from "./results/upload";
import { createRouter, RouterContext } from "./router/router";
import { screens } from "./screens";
import { createKeyDispatcher, KeyDispatcherContext } from "./shell/screen-keys";
import { Shell } from "./shell/shell";
import { createTestSources } from "./test/sources";
import {
  createTypingTest,
  TypingTestContext,
  type TypingTestOptions,
} from "./test/typing-test";
import { createRandomTheme } from "./theme/random";
import { createTheme, ThemeContext } from "./theme/theme";

export type AppProps = {
  config: ConfigStore;
  initialScreen?: ScreenId;
  onQuit: () => void;
  testOptions?: Partial<Omit<TypingTestOptions, "store">>;
  history?: HistoryStore;
  auth?: AuthStore;
  account?: Account;
  notifications?: Notifications;
};

export function App(props: AppProps) {
  const { config, initialScreen, testOptions, auth, account } = untrack(() => ({
    config: props.config,
    initialScreen: props.initialScreen,
    testOptions: props.testOptions,
    auth: props.auth,
    account: props.account,
  }));
  const dispatcher = createKeyDispatcher();
  const history = untrack(() => props.history) ?? createHistoryStore();
  const test = createTypingTest({
    store: config,
    sources: createTestSources(createAssetSource(), () => ({
      favoriteQuotes: account?.favorites.get(),
    })),
    getPaceSpeed: (settings, mode2) =>
      localPaceSpeed(
        history.entries(),
        settings,
        mode2,
        Date.now(),
        account?.tags.active(),
      ),
    getIdentity: account?.identity,
    getTags: account?.tags.active,
    ...testOptions,
  });
  const router = createRouter(initialScreen ?? "test", test.canInterrupt);
  const theme = createTheme(
    config.config,
    createRandomTheme(config.config, () => test.status() === "ready"),
  );
  const notifications =
    untrack(() => props.notifications) ?? createNotifications();
  config.setTestActive(() => test.status() === "running");
  onCleanup(
    config.onReject((failure) => notifications.notify(failure.message)),
  );
  onCleanup(() => notifications.dispose());
  const renderer = useRenderer();
  const palette = createPalette({
    root: () =>
      rootCommands({
        store: config,
        router,
        test,
        notifications,
        account,
        copy: (text) => renderer.copyToClipboardOSC52(text),
        openUrl: openBrowser,
      }),
    singleList: () => config.config.singleListCommandLine,
    onError: (message) => notifications.notify(message, "error"),
  });
  createEffect(
    on(test.result, (finished) => {
      if (finished !== undefined && config.config.resultSaving) {
        void history.add(finished);
        void account?.uploads.accept(finished);
      }
    }),
  );

  onMount(() => account?.start());
  onCleanup(() => account?.stop());
  return (
    <AccountContext.Provider value={account}>
      <UploadContext.Provider value={account?.uploads}>
        <AuthContext.Provider value={account?.auth ?? auth}>
          <ConfigContext.Provider value={config}>
            <ThemeContext.Provider value={theme}>
              <RouterContext.Provider value={router}>
                <KeyDispatcherContext.Provider value={dispatcher}>
                  <HistoryContext.Provider value={history}>
                    <TypingTestContext.Provider value={test}>
                      <NotificationsContext.Provider value={notifications}>
                        <PaletteContext.Provider value={palette}>
                          <Shell onQuit={props.onQuit}>
                            <Dynamic component={screens[router.current()]} />
                          </Shell>
                        </PaletteContext.Provider>
                      </NotificationsContext.Provider>
                    </TypingTestContext.Provider>
                  </HistoryContext.Provider>
                </KeyDispatcherContext.Provider>
              </RouterContext.Provider>
            </ThemeContext.Provider>
          </ConfigContext.Provider>
        </AuthContext.Provider>
      </UploadContext.Provider>
    </AccountContext.Provider>
  );
}
