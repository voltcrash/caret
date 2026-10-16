import { createAppOwned } from "../../app/application";
import { captureTypingMount } from "../../features/typing/scope";
import { revealPreparedTestPage } from "../states/page-transition";
import {
  showErrorNotification,
  showNoticeNotification,
  showSuccessNotification,
} from "../states/notifications";
import * as CustomText from "../../features/typing/runtime/custom-text";
import * as Funbox from "../../features/typing/runtime/funbox/funbox";

import { setConfig } from "../config/setters";
import { getMutableConfig } from "../config/store";
import { configEvent } from "../events/config";

import { ChallengeName } from "@oxytype/schemas/challenges";
import { CompletedEvent } from "@oxytype/schemas/results";
import { hideLoaderBar, showLoaderBar } from "../states/loader-bar";
import {
  isTestRestarting,
  getLoadedChallenge,
  setLoadedChallenge,
} from "../states/test";

const challengeState = createAppOwned(() => ({ loading: false, sequence: 0 }));

function clearActive(): void {
  if (
    getLoadedChallenge() !== null &&
    !challengeState().loading &&
    !isTestRestarting()
  ) {
    showNoticeNotification("Challenge cleared");
    setLoadedChallenge(null);
  }
}

export async function verify(
  result: CompletedEvent,
): Promise<ChallengeName | null> {
  const loadedChallenge = getLoadedChallenge();
  if (loadedChallenge === null) return null;
  try {
    const { verifyChallenge } = await import("@oxytype/challenges");
    const failReasons = verifyChallenge(
      result,
      getMutableConfig(),
      loadedChallenge,
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
  const sequence = ++state.sequence;
  const isCurrent = (): boolean =>
    lease.isCurrent() && state.sequence === sequence;
  state.loading = true;

  setConfig("funbox", []);

  const { getChallenge } = await import("@oxytype/challenges");
  if (!isCurrent()) {
    if (state.sequence === sequence) state.loading = false;
    return false;
  }
  const challenge = getChallenge(challengeName);
  const settings = challenge.settings;

  let notitext;
  try {
    if (challenge === undefined || settings === undefined) {
      showNoticeNotification("Challenge not found or missing settings");
      setTimeout(() => {
        revealPreparedTestPage();
      }, 250);
      return false;
    }
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
    revealPreparedTestPage();

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
    if (state.sequence === sequence) state.loading = false;
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
