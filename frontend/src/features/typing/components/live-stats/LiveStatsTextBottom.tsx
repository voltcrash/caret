import { FadeShow } from "#shared/components/common/FadeShow.tsx";
import { getConfig } from "#shared/config/store.ts";
import { cn } from "#shared/utils/cn.ts";

import {
  getLiveAccText,
  getLiveBurstText,
  getLiveSpeedText,
  showLiveStats,
} from "./state";
import {
  TEXT_DISPLAY_CLASS,
  TEXT_WRAPPER_CLASS,
  liveStatsTextColor,
} from "./styles";

export function LiveStatsTextBottom() {
  return (
    <div
      class={cn(TEXT_DISPLAY_CLASS, "mx-auto w-full", liveStatsTextColor())}
      style={{
        opacity: getConfig.timerOpacity,
      }}
    >
      <div class={cn(TEXT_WRAPPER_CLASS, "top-4")}>
        <FadeShow when={showLiveStats() && getConfig.liveSpeedStyle === "text"}>
          {getLiveSpeedText()}
        </FadeShow>
        <FadeShow when={showLiveStats() && getConfig.liveAccStyle === "text"}>
          {getLiveAccText()}
        </FadeShow>
        <FadeShow when={showLiveStats() && getConfig.liveBurstStyle === "text"}>
          {getLiveBurstText()}
        </FadeShow>
      </div>
    </div>
  );
}
