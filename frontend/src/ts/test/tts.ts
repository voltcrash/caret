import { onCleanup } from "solid-js";
import { createAppOwned } from "../../app/application";
import { getMutableConfig } from "../config/store";
import * as JSONData from "../utils/json-data";
import { configEvent } from "../events/config";
import { ttsEvent } from "../events/tts";
function createSpeech(): {
  useTtsEvents: typeof useTtsEvents;
} {
  let voice: SpeechSynthesisUtterance | undefined;
  async function setLanguage(
    lang = getMutableConfig().language,
  ): Promise<void> {
    if (!voice) return;
    const language = await JSONData.getLanguage(lang);
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
    window.speechSynthesis.cancel();
    if (voice === undefined) await init();

    if (voice !== undefined) {
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
      if (key === "language" && getMutableConfig().funbox.includes("tts")) {
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
const speech = createAppOwned(createSpeech);
export function useTtsEvents(): void {
  speech().useTtsEvents();
}
