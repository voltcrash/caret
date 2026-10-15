import { setOpenGraphUrl, setPageTitle } from "../states/page-head";
import { highlightSetting } from "../states/settings-highlight";
import { isAppLoading } from "../states/app";
import { isDevEnvironment } from "../utils/env";
import * as Misc from "../utils/misc";
import * as Strings from "../utils/strings";
import {
  getActivePage,
  setActivePage,
  setSelectedProfileName,
} from "../states/core";
import * as PageTest from "../pages/test";
import * as PageLoading from "../pages/loading";
import * as PageTransition from "../states/page-transition";
import { preloadPage } from "../components/pages/lazy-pages";
import * as Focus from "../test/focus";
import Page, {
  PageName,
  LoadingOptions,
  PageProperties,
  PageWithUrlParams,
  UrlParamsSchema,
  OptionsWithUrlParams,
} from "../pages/page";
import {
  LeaderboardUrlParamsSchema,
  readLeaderboardGetParameters,
} from "../states/leaderboard-selection";
import { sync as syncServerConfiguration } from "../ape/server-configuration";
import { getSnapshot } from "../db";
import * as TodayTracker from "../test/today-tracker";
import { isResultsReady } from "../states/results-ready";
import {
  readSettingsGetParameters,
  SettingsUrlParamsSchema,
} from "../states/settings-sections";

type ChangeOptions = {
  force?: boolean;
  params?: Record<string, string>;
  data?: unknown;
  loadingOptions?: LoadingOptions;
};

const pages = {
  loading: PageLoading.page,
  test: PageTest.page,
  settings: solidPage("settings", {
    urlParamsSchema: SettingsUrlParamsSchema,
    beforeShow: async (options) => {
      readSettingsGetParameters(options.urlParams);
      highlightSetting(
        new URLSearchParams(window.location.search).get("highlight"),
      );
    },
  }),
  about: solidPage("about"),
  account: solidPage("account", {
    loadingOptions: {
      loadingMode: () => (isResultsReady() ? "none" : "sync"),
      loadingPromise: async () => {
        if (getSnapshot() === null || getSnapshot() === undefined) {
          throw new Error(
            "Looks like your account data didn't download correctly. Please refresh the page.<br>If this error persists, please contact support.",
          );
        }
        const { waitForResultsReady } = await import("../collections/results");
        await waitForResultsReady();
        await TodayTracker.addAllFromToday();
      },
      style: "bar",
      keyframes: [
        {
          percentage: 90,
          durationMs: 2000,
          text: "Downloading results...",
        },
      ],
    },
  }),
  login: solidPage("login"),
  device: solidPage("device"),
  profile: solidPage("profile", {
    beforeShow: async (options) => {
      setSelectedProfileName(options.params?.["uidOrName"]);
    },
  }),
  profileSearch: solidPage("profileSearch"),
  404: solidPage("404"),
  leaderboards: solidPage("leaderboards", {
    urlParamsSchema: LeaderboardUrlParamsSchema,
    loadingOptions: {
      style: "spinner",
      loadingMode: () => "sync",
      loadingPromise: async () => {
        await syncServerConfiguration();
      },
    },
    beforeShow: async (options) => {
      readLeaderboardGetParameters(options.urlParams);
    },
  }),
};

function updateTitle(nextPage: { id: string; display?: string }): void {
  const local = isDevEnvironment() ? "localhost - " : "";
  if (nextPage.id === "test") {
    setPageTitle(`${local}Oxytype | A minimalistic, customizable typing test`);
  } else {
    const titleString =
      nextPage.display ?? Strings.capitalizeFirstLetterOfEachWord(nextPage.id);
    setPageTitle(`${local}${titleString} | Oxytype`);
  }
}

async function showSyncLoading({
  loadingOptions,
  totalDuration,
}: {
  loadingOptions: LoadingOptions[];
  totalDuration: number;
}): Promise<void> {
  PageTransition.preparePage("loading");
  await PageLoading.page.beforeShow({});

  const fillDivider = loadingOptions.length;
  const fillOffset = 100 / fillDivider;

  //void here to run the loading promise as soon as possible
  void PageTransition.transitionPage("loading", true, totalDuration / 2, false);

  for (let i = 0; i < loadingOptions.length; i++) {
    const currentOffset = fillOffset * i;
    const options = loadingOptions[i] as LoadingOptions;
    if (options.style === "bar") {
      await PageLoading.showBar();
      await PageLoading.updateBar(currentOffset, 0);
      if (i === 0) {
        PageLoading.updateText("");
      }
    } else {
      PageLoading.showSpinner();
    }

    if (options.style === "bar") {
      await getLoadingPromiseWithBarKeyframes(
        options,
        fillDivider,
        currentOffset,
      );
      // Each stage owns only its share of the progress. Complete it at once:
      // the data is ready, so animating the remainder only delays the page.
      await PageLoading.updateBar(fillOffset * (i + 1), 0);
    } else {
      await options.loadingPromise();
    }
  }

  await PageTransition.transitionPage("loading", false, totalDuration / 2);

  await PageLoading.page.afterHide();
}

// Global abort controller for keyframe promises
let keyframeAbortController: AbortController | null = null;

async function getLoadingPromiseWithBarKeyframes(
  loadingOptions: Extract<
    NonNullable<Page<unknown>["loadingOptions"]>,
    { style: "bar" }
  >,
  fillDivider: number,
  fillOffset: number,
): Promise<void> {
  let loadingPromise = loadingOptions.loadingPromise();

  // Create abort controller for this keyframe sequence
  const localAbortController = new AbortController();
  keyframeAbortController = localAbortController;

  // Animate bar keyframes, but allow aborting if loading.promise finishes first or if globally aborted
  const keyframePromise = (async () => {
    for (const keyframe of loadingOptions.keyframes) {
      if (localAbortController.signal.aborted) break;
      if (keyframe.text !== undefined) {
        PageLoading.updateText(keyframe.text);
      }
      await PageLoading.updateBar(
        fillOffset + keyframe.percentage / fillDivider,
        keyframe.durationMs,
      );
    }
  })();

  // Wait for either the keyframes or the loading.promise to finish
  await Promise.race([
    keyframePromise,
    (async () => {
      await loadingPromise;
      localAbortController.abort();
    })(),
  ]);

  // Always wait for loading.promise to finish before continuing
  await loadingPromise;

  // Clean up the abort controller
  if (keyframeAbortController === localAbortController) {
    keyframeAbortController = null;
  }

  return;
}

export async function change(
  pageName: PageName,
  options = {} as ChangeOptions,
): Promise<boolean> {
  const defaultOptions = {
    force: false,
  };

  options = { ...defaultOptions, ...options };

  if (PageTransition.get() && !options.force) {
    console.debug(
      `change page to ${pageName} stopped, page transition is true`,
    );
    return false;
  }

  if (!options.force && getActivePage() === pageName) {
    console.debug(`change page ${pageName} stoped, page already active`);
    return false;
  } else {
    console.log(`changing page ${pageName}`);
  }

  const previousPage = pages[getActivePage()];
  const nextPage = pages[pageName];
  // The startup screen covers navigation until the app has loaded, so fades
  // behind it would only delay the first page.
  const totalDuration = isAppLoading() ? 0 : Misc.applyReducedMotion(250);

  //start
  PageTransition.set(true);
  // Fetch the destination while the outgoing page fades and user data loads.
  const pageReady = preloadPage(pageName);
  void pageReady.catch(() => undefined);

  //previous page
  await previousPage?.beforeHide?.();
  await PageTransition.transitionPage(
    previousPage.id,
    false,
    totalDuration / 2,
  );
  await previousPage?.afterHide();

  // we need to evaluate and store next page loading mode in case options.loadingOptions.loadingMode is sync
  const nextPageLoadingMode = nextPage.loadingOptions?.loadingMode();

  //show loading page if needed
  try {
    let syncLoadingOptions: LoadingOptions[] = [];
    if (options.loadingOptions?.loadingMode() === "sync") {
      syncLoadingOptions.push(options.loadingOptions);
    }
    if (nextPage.loadingOptions?.loadingMode() === "sync") {
      syncLoadingOptions.push(nextPage.loadingOptions);
    }

    if (syncLoadingOptions.length > 0) {
      await showSyncLoading({
        loadingOptions: syncLoadingOptions,
        totalDuration,
      });
    }
    await pageReady;

    // Clean up abort controller after successful loading
    if (keyframeAbortController) {
      keyframeAbortController = null;
    }
  } catch (error) {
    // Abort any running keyframe promises
    if (keyframeAbortController) {
      keyframeAbortController.abort();
      keyframeAbortController = null;
    }

    PageTransition.activatePage("loading");
    setActivePage(pages.loading.id);
    Focus.set(false);
    PageLoading.showError();
    PageLoading.updateText(
      `Failed to load the ${nextPage.id} page: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    PageTransition.set(false);
    return false;
  }

  //between
  updateTitle(nextPage);
  setActivePage(nextPage.id);
  setOpenGraphUrl(window.location.href);
  Focus.set(false);

  //next page
  PageTransition.preparePage(nextPage.id);
  await nextPage?.beforeShow({
    params: options.params,
    data: options.data,
  });

  if (
    typeof nextPageLoadingMode === "object" &&
    nextPageLoadingMode.mode === "async"
  ) {
    nextPageLoadingMode.beforeLoading?.();
    void nextPage?.loadingOptions?.loadingPromise().then(() => {
      nextPageLoadingMode.afterLoading?.();
    });
  }

  await PageTransition.transitionPage(nextPage.id, true, totalDuration / 2);
  await nextPage?.afterShow();

  //wrapup
  PageTransition.set(false);
  return true;
}

function solidPage(
  id: PageName,
  props?: {
    path?: string;
    urlParamsSchema?: never;
    loadingOptions?: LoadingOptions;
    beforeShow?: PageProperties<unknown>["beforeShow"];
    afterHide?: () => Promise<void>;
  },
): Page<unknown>;
function solidPage<U extends UrlParamsSchema>(
  id: PageName,
  props: {
    path?: string;
    urlParamsSchema: U;
    loadingOptions?: LoadingOptions;
    beforeShow?: (options: OptionsWithUrlParams<unknown, U>) => Promise<void>;
    afterHide?: () => Promise<void>;
  },
): PageWithUrlParams<unknown, U>;
function solidPage<U extends UrlParamsSchema>(
  id: PageName,
  props?: {
    path?: string;
    urlParamsSchema?: U;
    loadingOptions?: LoadingOptions;
    beforeShow?: (options: OptionsWithUrlParams<unknown, U>) => Promise<void>;
    afterHide?: () => Promise<void>;
  },
): Page<unknown> | PageWithUrlParams<unknown, U> {
  const path = props?.path ?? `/${id}`;

  const shared = {
    id,
    path,
    loadingOptions: props?.loadingOptions,
    afterHide: async () => {
      await props?.afterHide?.();
    },
  };

  if (props?.urlParamsSchema !== undefined) {
    return new PageWithUrlParams({
      ...shared,
      urlParamsSchema: props.urlParamsSchema,
      beforeShow: async (options) => {
        await props.beforeShow?.(options);
      },
    });
  }

  return new Page({
    ...shared,
    beforeShow: async (options) => {
      await props?.beforeShow?.(options);
    },
  });
}
