import { AnimeShow } from "../../../../ts/components/common/anime";
import { getConfig } from "../../../../ts/config/store";
import {
  getLiveAccText,
  getLiveBurstText,
  getLiveSpeedText,
  getTimerText,
  isTimerFlashHidden,
  showLiveStats,
} from "../../../../ts/states/live-stats";
import { cn } from "../../../../ts/utils/cn";
import { getWordsFontSize } from "../../../../ts/utils/words-font";
import { liveStatsTextColor } from "./styles";

export function LiveStatsMini() {
  const isTape = () => getConfig.tapeMode !== "off";

  return (
    <div class="full-width">
      <div
        class={cn("mt-[-1.25em] flex h-0 w-0 gap-[0.5em] leading-[1em]", {
          "justify-center": isTape(),
          "justify-start": !isTape(),
          ...liveStatsTextColor(),
        })}
        style={{
          "font-size": getWordsFontSize(getConfig.fontSize),
          opacity: getConfig.timerOpacity,
          "margin-left": isTape() ? `${getConfig.tapeMargin}%` : "0.25em",
        }}
      >
        <AnimeShow
          when={
            showLiveStats() &&
            ["mini", "flash_mini"].includes(getConfig.timerStyle)
          }
        >
          {/* the fade animates the wrapper opacity, so the flash gate lives on the child */}
          <div style={{ opacity: isTimerFlashHidden() ? 0 : 1 }}>
            {getTimerText()}
          </div>
        </AnimeShow>
        <AnimeShow
          when={showLiveStats() && getConfig.liveSpeedStyle === "mini"}
        >
          {getLiveSpeedText()}
        </AnimeShow>
        <AnimeShow when={showLiveStats() && getConfig.liveAccStyle === "mini"}>
          {getLiveAccText()}
        </AnimeShow>
        <AnimeShow
          when={showLiveStats() && getConfig.liveBurstStyle === "mini"}
        >
          {getLiveBurstText()}
        </AnimeShow>
      </div>
    </div>
  );
}
