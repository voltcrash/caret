import { createWordIcon } from "../../components/pages/test/words/icons";
import { FunboxWordFunctions } from "@oxytype/typing-core/active-funboxes";
import { createFunboxWordFunctions } from "@oxytype/typing-core/funbox-word-functions";
import {
  setCrt,
  setReadAheadDisabled,
  setWordsVisible,
  setWordsWrapperVisible,
} from "../../states/funbox";
import { getMutableConfig } from "../../config/store";
import { setConfig, toggleFunbox } from "../../config/setters";
import { save } from "./funbox-memory";
import { ttsEvent } from "../../events/tts";
import {
  showNoticeNotification,
  showErrorNotification,
} from "../../states/notifications";
import * as TestWords from "../test-words";
import { getCurrentInput, getInputForWord } from "../events/data";
import * as LayoutfluidFunboxTimer from "./layoutfluid-funbox-timer";
import { highlight } from "../../events/keymap";
import * as MemoryTimer from "./memory-funbox-timer";
import { getPoem } from "../poetry";
import * as JSONData from "../../utils/json-data";
import { getSection } from "../wikipedia";
import * as WeakSpot from "../weak-spot";
import { getActiveWordIndex } from "../../states/test";
import { FunboxName, KeymapLayout, Layout } from "@oxytype/schemas/configs";

export type FunboxFunctions = FunboxWordFunctions & {
  applyConfig?: () => void;
  applyGlobalCSS?: () => void;
  clearGlobal?: () => void;
  rememberSettings?: () => void;
  toggleScript?: (params: string[]) => void;
  handleSpace?: () => void;
  getEmulatedChar?: (event: KeyboardEvent) => string | null;
  handleKeydown?: (event: KeyboardEvent) => Promise<void>;
  getResultContent?: () => string;
  start?: () => void;
  restart?: () => void;
  getWordNode?: (char: string) => Node | undefined;
};

async function readAheadHandleKeydown(event: KeyboardEvent): Promise<void> {
  const currentInput = getCurrentInput();
  const currentWord = TestWords.words.getCurrent();

  if (!currentWord) {
    return;
  }

  const inputCurrentChar = currentInput.slice(-1);
  const wordCurrentChar = currentWord.display.slice(
    currentInput.length - 1,
    currentInput.length,
  );
  const isCorrect = inputCurrentChar === wordCurrentChar;

  if (
    event.key === "Backspace" &&
    !isCorrect &&
    (currentInput !== "" ||
      getInputForWord(getActiveWordIndex() - 1) !==
        TestWords.words.get(getActiveWordIndex() - 1)?.textWithCommit ||
      getMutableConfig().freedomMode)
  ) {
    setReadAheadDisabled(true);
  } else if (event.key === " ") {
    setReadAheadDisabled(false);
  }
}

const list: Partial<Record<FunboxName, FunboxFunctions>> = {
  "58008": {
    rememberSettings(): void {
      save("numbers", getMutableConfig().numbers);
    },
    getEmulatedChar(event: KeyboardEvent): string | null {
      if (event.key === "Enter") {
        return " ";
      }
      return null;
    },
  },
  simon_says: {
    applyConfig(): void {
      setConfig("keymapMode", "next", {
        nosave: true,
      });
    },
    rememberSettings(): void {
      save("keymapMode", getMutableConfig().keymapMode);
    },
  },
  tts: {
    applyConfig(): void {
      setConfig("keymapMode", "off", {
        nosave: true,
      });
    },
    rememberSettings(): void {
      save("keymapMode", getMutableConfig().keymapMode);
    },
    toggleScript(params: string[]): void {
      if (window.speechSynthesis === undefined) {
        showErrorNotification("Failed to load text-to-speech script");
        return;
      }
      if (params[0] !== undefined) ttsEvent.dispatch(params[0]);
    },
  },
  arrows: {
    rememberSettings(): void {
      save("highlightMode", getMutableConfig().highlightMode);
    },
    getEmulatedChar(event: KeyboardEvent): string | null {
      const ekey = event.key;
      if (ekey === "a" || ekey === "ArrowLeft" || ekey === "j") {
        return "←";
      }
      if (ekey === "s" || ekey === "ArrowDown" || ekey === "k") {
        return "↓";
      }
      if (ekey === "w" || ekey === "ArrowUp" || ekey === "i") {
        return "↑";
      }
      if (ekey === "d" || ekey === "ArrowRight" || ekey === "l") {
        return "→";
      }
      return null;
    },
    getWordNode(char: string): Node | undefined {
      if (char === "↑") return createWordIcon({ icon: "fa-arrow-up" });
      if (char === "↓") return createWordIcon({ icon: "fa-arrow-down" });
      if (char === "←") return createWordIcon({ icon: "fa-arrow-left" });
      if (char === "→") return createWordIcon({ icon: "fa-arrow-right" });
      return undefined;
    },
  },
  rAnDoMcAsE: {},
  sPoNgEcAsE: {},
  rot13: {},
  backwards: {},
  capitals: {},
  layout_mirror: {
    applyConfig(): void {
      let layout = getMutableConfig().layout;
      if (getMutableConfig().layout === "default") {
        layout = "qwerty";
      }
      setConfig("layout", layout, {
        nosave: true,
      });
      setConfig("keymapLayout", "overrideSync", {
        nosave: true,
      });
    },
    rememberSettings(): void {
      save("keymapMode", getMutableConfig().keymapMode);
      save("layout", getMutableConfig().layout);
    },
  },
  layoutfluid: {
    applyConfig(): void {
      const layout = getMutableConfig().customLayoutfluid[0] ?? "qwerty";

      setConfig("layout", layout as Layout, {
        nosave: true,
      });
      setConfig("keymapLayout", layout as KeymapLayout, {
        nosave: true,
      });
    },
    rememberSettings(): void {
      save("keymapMode", getMutableConfig().keymapMode);
      save("layout", getMutableConfig().layout);
      save("keymapLayout", getMutableConfig().keymapLayout);
    },
    handleSpace(): void {
      if (getMutableConfig().mode !== "time") {
        const layouts = getMutableConfig().customLayoutfluid;
        const outOf: number = TestWords.words.length;
        const wordsPerLayout = Math.floor(outOf / layouts.length);
        const index = Math.floor((getActiveWordIndex() + 1) / wordsPerLayout);
        const mod =
          wordsPerLayout - ((getActiveWordIndex() + 1) % wordsPerLayout);

        if (layouts[index] as string) {
          if (mod <= 3 && (layouts[index + 1] as string)) {
            LayoutfluidFunboxTimer.show();
            LayoutfluidFunboxTimer.updateWords(
              mod,
              layouts[index + 1] as string,
            );
          } else {
            LayoutfluidFunboxTimer.hide();
          }
          if (mod === wordsPerLayout) {
            setConfig("layout", layouts[index] as Layout);
            setConfig("keymapLayout", layouts[index] as KeymapLayout);
            if (mod > 3) {
              LayoutfluidFunboxTimer.hide();
            }
          }
        } else {
          LayoutfluidFunboxTimer.hide();
        }
        setTimeout(() => {
          highlight(
            TestWords.words
              .getCurrent()
              ?.text.charAt(getCurrentInput().length) ?? "",
          );
        }, 1);
      }
    },
    getResultContent(): string {
      return getMutableConfig().customLayoutfluid.join(" ");
    },
  },
  gibberish: {},
  ascii: {},
  specials: {},
  read_ahead_easy: {
    rememberSettings(): void {
      save("highlightMode", getMutableConfig().highlightMode);
    },
    async handleKeydown(event): Promise<void> {
      await readAheadHandleKeydown(event);
    },
  },
  read_ahead: {
    rememberSettings(): void {
      save("highlightMode", getMutableConfig().highlightMode);
    },
    async handleKeydown(event): Promise<void> {
      await readAheadHandleKeydown(event);
    },
  },
  read_ahead_hard: {
    rememberSettings(): void {
      save("highlightMode", getMutableConfig().highlightMode);
    },
    async handleKeydown(event): Promise<void> {
      await readAheadHandleKeydown(event);
    },
  },
  memory: {
    applyConfig(): void {
      setWordsWrapperVisible(false);
      setConfig("showAllLines", true, {
        nosave: true,
      });
      if (getMutableConfig().keymapMode === "next") {
        setConfig("keymapMode", "react", {
          nosave: true,
        });
      }
    },
    rememberSettings(): void {
      save("mode", getMutableConfig().mode);
      save("showAllLines", getMutableConfig().showAllLines);
      if (getMutableConfig().keymapMode === "next") {
        save("keymapMode", getMutableConfig().keymapMode);
      }
    },
    start(): void {
      MemoryTimer.reset();
      setWordsVisible(false);
    },
    restart(): void {
      MemoryTimer.start(Math.round(Math.pow(TestWords.words.length, 1.2)));
      setWordsVisible(true);
      if (getMutableConfig().keymapMode === "next") {
        setConfig("keymapMode", "react");
      }
    },
  },
  nospace: {
    rememberSettings(): void {
      save("highlightMode", getMutableConfig().highlightMode);
    },
  },
  poetry: {},
  wikipedia: {},
  weakspot: {},
  pseudolang: {},
  IPv4: {
    rememberSettings(): void {
      save("numbers", getMutableConfig().numbers);
    },
  },
  IPv6: {
    rememberSettings(): void {
      save("numbers", getMutableConfig().numbers);
    },
  },
  binary: {},
  hexadecimal: {
    rememberSettings(): void {
      save("punctuation", getMutableConfig().punctuation);
    },
  },
  zipf: {},
  ddoouubblleedd: {},
  instant_messaging: {},
  morse: {},
  underscore_spaces: {},
  crt: {
    applyGlobalCSS(): void {
      const isSafari = /^((?!chrome|android).)*safari/i.test(
        navigator.userAgent,
      );
      if (isSafari) {
        //Workaround for bug https://bugs.webkit.org/show_bug.cgi?id=256171 in Safari 16.5 or earlier
        const versionMatch = /.*Version\/([0-9]*)\.([0-9]*).*/.exec(
          navigator.userAgent,
        );
        const mainVersion =
          versionMatch !== null ? parseInt(versionMatch[1] ?? "0") : 0;
        const minorVersion =
          versionMatch !== null ? parseInt(versionMatch[2] ?? "0") : 0;
        if (mainVersion <= 16 && minorVersion <= 5) {
          showNoticeNotification(
            "CRT is not available on Safari 16.5 or earlier.",
            {
              durationMs: 5000,
            },
          );
          toggleFunbox("crt");
          return;
        }
      }
      setCrt({});
    },
    clearGlobal(): void {
      setCrt(null);
    },
  },
  ALL_CAPS: {},
  polyglot: {},
};

export function getFunboxFunctions(): Record<FunboxName, FunboxFunctions> {
  const wordFunctions = createFunboxWordFunctions({
    getConfig: () => getMutableConfig(),
    getLanguage: JSONData.getLanguage,
    getPoem,
    getSection,
    getWeakSpotWord: (wordset) => WeakSpot.getWord(wordset),
    notify: showNoticeNotification,
    disableFunbox: (name, noRestart) => {
      toggleFunbox(name, noRestart);
    },
    setLanguage: (language, noSave) => {
      setConfig("language", language, { nosave: noSave });
    },
  });
  const merged = { ...list } as Record<FunboxName, FunboxFunctions>;
  for (const [name, hooks] of Object.entries(wordFunctions)) {
    const key = name as FunboxName;
    merged[key] = { ...merged[key], ...hooks };
  }
  return merged;
}
