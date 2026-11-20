import { createAppOwned } from "#app/application.ts";
import { getBrowserAudit } from "#shared/engine/audit.client.ts";
import { captureTypingMount } from "../scope";
import {
  showErrorNotification,
  showNoticeNotification,
  showSuccessNotification,
} from "#shared/states/notifications.ts";
import * as CustomText from "./content/custom-text";
import * as Funbox from "./funbox/funbox";

import { setConfig } from "#shared/config/setters.ts";
import { peekConfig } from "#shared/config/store.ts";
import { configEvent } from "#shared/events/config.ts";

import { ChallengeName } from "@caret/schemas/challenges";
import { CompletedEvent } from "@caret/schemas/results";
import { hideLoaderBar, showLoaderBar } from "#shared/states/loader-bar.ts";
import {
  isTestRestarting,
  getLoadedChallenge,
  setLoadedChallenge,
} from "#shared/states/test.ts";

const challengeState = createAppOwned((): { request?: symbol } => ({}));

function clearActive(): void {
  if (
    getLoadedChallenge() !== null &&
    challengeState().request === undefined &&
    !isTestRestarting()
  ) {
    showNoticeNotification("Challenge cleared");
    setLoadedChallenge(null);
  }
}

export async function verify(
  result: CompletedEvent,
  config = { ...peekConfig() },
): Promise<ChallengeName | null> {
  const loadedChallenge = getLoadedChallenge();
  if (loadedChallenge === null) return null;
  try {
    const audit = await getBrowserAudit().load();
    const failReasons = audit.challenge(
      {
        wpm: result.wpm,
        acc: result.acc,
        rawWpm: result.rawWpm,
        consistency: result.consistency,
        afkDuration: result.afkDuration,
        testDuration: result.testDuration,
        funbox: result.funbox,
      },
      config,
      loadedChallenge.settings.requirements ?? null,
    );
    if (failReasons.length === 0) {
      showSuccessNotification(`${loadedChallenge.display} challenge passed!`);
      return loadedChallenge.name;
    }
    showNoticeNotification(
      `${loadedChallenge.display} challenge failed: ${failReasons.join(", ")}`,
    );
    return null;
  } catch (e) {
    console.error(e);
    showNoticeNotification(
      `Something went wrong when verifying challenge: ${(e as Error).message}`,
    );
    return null;
  }
}

export async function setup(challengeName: ChallengeName): Promise<boolean> {
  const lease = captureTypingMount();
  const state = challengeState();
  const request = Symbol(challengeName);
  state.request = request;
  const isCurrent = (): boolean =>
    lease.isCurrent() && state.request === request;

  try {
    const { getChallenge } = await import("@caret/challenges");
    if (!isCurrent()) return false;
    const challenge = getChallenge(challengeName);
    const settings = challenge?.settings;
    // fetch the rules module now so verifying the result never waits on it;
    // verify retries the download if this attempt fails
    void getBrowserAudit()
      .load()
      .catch(() => undefined);

    let notitext;
    if (challenge === undefined || settings === undefined) {
      showNoticeNotification("Challenge not found or missing settings");
      return false;
    }
    setConfig("funbox", []);
    if (settings.type === "customTime") {
      setConfig("time", settings.parameters.time, {
        nosave: true,
      });
      setConfig("mode", "time", {
        nosave: true,
      });
      setConfig("difficulty", "normal", {
        nosave: true,
      });
      if (challengeName === "englishMaster") {
        setConfig("language", "english_10k", {
          nosave: true,
        });
        setConfig("numbers", true, {
          nosave: true,
        });
        setConfig("punctuation", true, {
          nosave: true,
        });
      }
    } else if (settings.type === "customWords") {
      setConfig("words", settings.parameters.words, {
        nosave: true,
      });
      setConfig("mode", "words", {
        nosave: true,
      });
      setConfig("difficulty", "normal", {
        nosave: true,
      });
    } else if (settings.type === "customText") {
      CustomText.setText(settings.parameters.text.split(" "));
      CustomText.setMode(settings.parameters.mode);
      CustomText.setLimitValue(settings.parameters.limit);
      CustomText.setLimitMode(settings.parameters.limitMode);
      CustomText.setPipeDelimiter(settings.parameters.isPipeDelimiter);
      setConfig("mode", "custom", {
        nosave: true,
      });
      setConfig("difficulty", "normal", {
        nosave: true,
      });
    } else if (settings.type === "script") {
      showLoaderBar();
      const response = await fetch(`/challenges/${settings.parameters.script}`);
      if (!isCurrent()) return false;
      hideLoaderBar();
      if (response.status !== 200) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      const scriptdata = await response.text();
      if (!isCurrent()) return false;
      let text = scriptdata.trim();
      text = text.replace(/[\n\r\t ]/gm, " ");
      text = text.replace(/ +/gm, " ");
      CustomText.setText(text.split(" "));
      CustomText.setMode("repeat");
      CustomText.setLimitMode("word");
      CustomText.setPipeDelimiter(false);
      setConfig("mode", "custom", {
        nosave: true,
      });
      setConfig("difficulty", "normal", {
        nosave: true,
      });
      if (settings.parameters.theme !== undefined) {
        setConfig("theme", settings.parameters.theme);
      }
      if (settings.parameters.funboxes !== undefined) {
        void Funbox.activate(settings.parameters.funboxes);
      }
    } else if (settings.type === "accuracy") {
      setConfig("time", 0, {
        nosave: true,
      });
      setConfig("mode", "time", {
        nosave: true,
      });
      setConfig("difficulty", "master", {
        nosave: true,
      });
    } else if (settings.type === "funbox") {
      setConfig("difficulty", "normal", {
        nosave: true,
      });
      if (settings.parameters.mode === "words") {
        setConfig("words", settings.parameters.mode2, {
          nosave: true,
        });
      } else if (settings.parameters.mode === "time") {
        setConfig("time", settings.parameters.mode2, {
          nosave: true,
        });
      }
      setConfig("mode", settings.parameters.mode, {
        nosave: true,
      });
      if (settings.parameters.difficulty !== undefined) {
        setConfig("difficulty", settings.parameters.difficulty, {
          nosave: true,
        });
      }

      if (
        !setConfig("funbox", [settings.parameters.funbox], {
          nosave: true,
        })
      ) {
        throw new Error("Can't load challenge with current config");
      }
    } else if (settings.type === "other") {
      if (challengeName === "wingdings") {
        // Ten Words of Pain: 10-word Master mode test using the Wingdings custom font, no keymap
        setConfig("mode", "words", {
          nosave: true,
        });
        setConfig("words", 10, {
          nosave: true,
        });
        setConfig("difficulty", "master", {
          nosave: true,
        });
        setConfig("fontFamily", "Wingdings", {
          nosave: true,
        });
        setConfig("keymapMode", "off", {
          nosave: true,
        });
      }
    }
    notitext = settings.message;

    if (notitext === undefined) {
      showSuccessNotification(`Challenge '${challenge.display}' loaded.`);
    } else {
      showSuccessNotification(`Challenge loaded. ${notitext}`);
    }
    setLoadedChallenge(challenge);
    return true;
  } catch (e) {
    if (isCurrent()) {
      showErrorNotification("Failed to load challenge", { error: e });
    }
    return false;
  } finally {
    if (state.request === request) {
      delete state.request;
      hideLoaderBar();
    }
  }
}

export function useChallengeEvents(): void {
  configEvent.useListener(({ key }) => {
    if (
      [
        "difficulty",
        "numbers",
        "punctuation",
        "mode",
        "funbox",
        "paceCaret",
        "showAllLines",
        "showLiveWpm",
        "highlightMode",
        "time",
        "words",
        "keymapMode",
        "keymapLayout",
        "layout",
        "fontFamily",
      ].includes(key)
    ) {
      clearActive();
    }
  });
}
