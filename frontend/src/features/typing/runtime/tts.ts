import { onCleanup } from "solid-js";
import { createTypingOwned, captureTypingRoute } from "../scope";
import { peekConfig } from "#shared/config/store.ts";
import * as JSONData from "#shared/utils/json-data.ts";
import { configEvent } from "#shared/events/config.ts";
import { ttsEvent } from "./events/tts";
function createSpeech(): {
  useTtsEvents: typeof useTtsEvents;
} {
  let voice: SpeechSynthesisUtterance | undefined;
  let languageRevision = 0;
  async function setLanguage(lang = peekConfig().language): Promise<void> {
    if (!voice) return;
    const target = voice;
    const revision = ++languageRevision;
    const language = await JSONData.getLanguage(lang);
    if (voice !== target || revision !== languageRevision) return;
    const bcp = language.bcp47 ?? "en-US";
    voice.lang = bcp;
  }
  async function init(): Promise<void> {
    voice = new SpeechSynthesisUtterance();
    await setLanguage();
  }
  function clear(): void {
    voice = undefined;
  }
  async function speak(text: string): Promise<void> {
    const lease = captureTypingRoute();
    window.speechSynthesis.cancel();
    if (voice === undefined) await init();

    if (lease.isCurrent() && voice !== undefined) {
      voice.text = text;
      window.speechSynthesis.speak(voice);
    }
  }
  function useTtsEvents(): void {
    configEvent.useListener(({ key, newValue }) => {
      if (key === "funbox") {
        if (newValue.includes("tts")) {
          void init();
        } else {
          clear();
        }
      }
      if (key === "language" && peekConfig().funbox.includes("tts")) {
        void setLanguage();
      }
    });
    ttsEvent.useListener((text) => {
      void speak(text);
    });
  }
  function disposeSpeech(): void {
    window.speechSynthesis?.cancel();
    clear();
  }
  onCleanup(disposeSpeech);
  return { useTtsEvents };
}
const speech = createTypingOwned(createSpeech);
export function useTtsEvents(): void {
  speech().useTtsEvents();
}
