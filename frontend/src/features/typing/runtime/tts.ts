import { onCleanup } from "solid-js";
import { createTypingOwned, captureTypingRoute } from "../scope";
import { getMutableConfig } from "../../../ts/config/store";
import * as JSONData from "../../../ts/utils/json-data";
import { configEvent } from "../../../ts/events/config";
import { ttsEvent } from "../../../ts/events/tts";
function createSpeech(): {
  useTtsEvents: typeof useTtsEvents;
} {
  let voice: SpeechSynthesisUtterance | undefined;
  async function setLanguage(
    lang = getMutableConfig().language,
  ): Promise<void> {
    if (!voice) return;
    const target = voice;
    const language = await JSONData.getLanguage(lang);
    if (voice !== target) return;
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
const speech = createTypingOwned(createSpeech);
export function useTtsEvents(): void {
  speech().useTtsEvents();
}
