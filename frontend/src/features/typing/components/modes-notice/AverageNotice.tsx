import { createMemo, JSXElement } from "solid-js";

import { getConfig } from "#shared/config/store.ts";
import { getFormatting, isAuthenticated } from "#shared/states/core.ts";

import { useUserAverage10LiveQuery } from "../../../../data/collections/results";
import { Notice } from "./Notice";

export function AverageNotice(): JSXElement {
  const last10 = useUserAverage10LiveQuery({
    isEnabled: () => isAuthenticated() && getConfig.showAverage !== "off",
  });

  const displayText = createMemo(() => {
    const average = last10();
    if (average === undefined || Array.isArray(average)) return "no average";

    const format = getFormatting();
    let speed = undefined;
    let acc = undefined;

    if (getConfig.showAverage === "both" || getConfig.showAverage === "speed") {
      speed = format.typingSpeed(average.wpm ?? 0, {
        suffix: ` ${getConfig.typingSpeedUnit}`,
      });
    }

    if (getConfig.showAverage === "both" || getConfig.showAverage === "acc") {
      acc = format.accuracy(average.acc ?? 0, {
        suffix: " acc",
      });
    }

    return [speed, acc].filter((it) => it !== undefined).join("\n");
  });

  return (
    <Notice
      compact
      class="motion-safe:animate-content-in"
      when={
        isAuthenticated() && last10.isReady && getConfig.showAverage !== "off"
      }
      icon="fa-chart-bar"
      openCommandline="showAverage"
      text={displayText()}
    />
  );
}
