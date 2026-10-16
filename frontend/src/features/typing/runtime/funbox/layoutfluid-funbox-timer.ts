import { capitalizeFirstLetter } from "../../../../ts/utils/strings";
import {
  setLayoutfluidTimerText,
  setLayoutfluidTimerVisibility,
} from "../../../../ts/states/funbox-timers";

export function show(): void {
  setLayoutfluidTimerVisibility("shown");
}

export function hide(): void {
  setLayoutfluidTimerVisibility("hidden");
}

export function instantHide(): void {
  setLayoutfluidTimerVisibility("instant");
}

export function updateTime(sec: number, layout: string): void {
  setLayoutfluidTimerText(`${capitalizeFirstLetter(layout)} in: ${sec}s`);
}

export function updateWords(words: number, layout: string): void {
  const layoutName = capitalizeFirstLetter(layout.replace(/_/g, " "));
  let str = `${layoutName} in: ${words} words`;
  if (words === 1) {
    str = `${layoutName} starting next word`;
  }
  setLayoutfluidTimerText(str);
}
