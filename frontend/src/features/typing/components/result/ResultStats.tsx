import { For, JSXElement, Show } from "solid-js";

import { resultState } from "../../../../ts/states/result";
import { cn } from "../../../../ts/utils/cn";
import { ResultCrown } from "./ResultCrown";
import { ResultDailyLeaderboard } from "./ResultDailyLeaderboard";
import { ResultQuoteActions } from "./ResultQuoteActions";
import { ResultTags } from "./ResultTags";

const topClass =
  "top mb-1 text-[1rem] leading-[1rem] text-text max-md:text-[0.8125rem]";
const bottomClass = "bottom text-[2rem] leading-[2rem] text-main";
// phones: wpm and acc sit side by side as a scoreboard, sized to fit 320px
const bigTopClass =
  "top mb-1 text-[2rem] leading-[1.5rem] text-text max-md:mb-0 max-md:text-[0.875rem] max-md:leading-[1rem]";
const bigBottomClass = "bottom text-[4rem] leading-[4rem] text-main";
const wpmBigBottomClass = cn(
  bigBottomClass,
  "max-md:leading-none max-md:[font-size:clamp(3.5rem,20vw,4.75rem)]",
);
const accBigBottomClass = cn(
  bigBottomClass,
  "max-md:leading-none max-md:text-text max-md:[font-size:clamp(2.25rem,12vw,3rem)]",
);
const smallTopClass = cn(topClass, "flex flex-wrap items-center");
const smallBottomClass = "bottom text-[1rem] leading-[1rem] text-main";
// balloons would overflow the screen on narrow layouts
const moreStatsBottomClass =
  "max-sm:after:left-0! max-sm:after:transform-none!";
// two phone columns are ~136px wide on 320px screens
const valueClass = "max-md:text-[1.5rem] max-md:leading-[1.5rem]";
const subTextClass = "ml-[0.2rem] text-[0.75rem] leading-[0.75rem] text-text";

function Lines(props: { lines: string[] | undefined }): JSXElement {
  return (
    <Show when={props.lines} fallback="-">
      {(lines) => (
        <For each={lines()}>
          {(line, i) => (
            <>
              <Show when={i() > 0}>
                <br />
              </Show>
              {line}
            </>
          )}
        </For>
      )}
    </Show>
  );
}

export function ResultStats(): JSXElement {
  const stats = () => resultState.stats;

  return (
    <>
      <div
        class={cn(
          "stats grid items-center justify-center gap-2 [grid-area:stats] [grid-template-areas:'wpm'_'acc']",
          "max-md:grid-cols-[1fr_1fr] max-md:justify-items-center max-md:[grid-template-areas:'wpm_acc']",
          resultState.noStress && "hidden",
        )}
      >
        <div class="group wpm max-md:text-center [grid-area:wpm]">
          <div class={cn(bigTopClass, "flex max-md:justify-center")}>
            <div class="text">{stats()?.typingSpeedUnit ?? "wpm"}</div>
            <ResultCrown />
          </div>
          <div
            class={wpmBigBottomClass}
            aria-label={stats()?.wpm.ariaLabel}
            data-balloon-pos="up"
          >
            {stats()?.wpm.text ?? "-"}
          </div>
        </div>
        <div class="group acc max-md:text-center [grid-area:acc]">
          <div class={bigTopClass}>acc</div>
          <div
            class={accBigBottomClass}
            aria-label={stats()?.acc.ariaLabel}
            data-balloon-pos="up"
            data-balloon-break={stats()?.acc.balloonBreak ? "" : undefined}
          >
            {stats()?.acc.text ?? "-"}
          </div>
        </div>
      </div>
      <div
        class={cn(
          "stats morestats grid grid-flow-col items-start justify-between gap-x-8 gap-y-2 [grid-area:morestats]",
          "max-lg:grid-cols-[repeat(3,max-content)] max-lg:grid-rows-[1fr_1fr]",
          // phones: two columns, row-major; wide rows span both
          "max-md:grid-flow-row max-md:grid-cols-[repeat(2,minmax(0,1fr))] max-md:grid-rows-none max-md:justify-items-start max-md:gap-x-4 max-md:gap-y-3 max-md:[overflow-wrap:anywhere]",
          resultState.noStress && "hidden",
        )}
      >
        <div class="group testType max-md:col-span-full">
          <div class={topClass}>test type</div>
          <div
            class={cn(
              "bottom text-[1rem] leading-[1.25] text-main",
              moreStatsBottomClass,
            )}
          >
            <Lines lines={stats()?.testType} />
          </div>
          <ResultTags
            topClass={smallTopClass}
            bottomClass={cn(
              "bottom text-[1rem] leading-[1.25] text-main",
              moreStatsBottomClass,
            )}
          />
        </div>
        <div
          class={cn(
            "group info max-md:col-span-full",
            (stats()?.other.length ?? 0) === 0 && "hidden",
          )}
        >
          <div class={smallTopClass}>other</div>
          <div class={cn(smallBottomClass, moreStatsBottomClass)}>
            <Lines lines={stats()?.other} />
          </div>
        </div>
        <div class="group raw">
          <div class={topClass}>raw</div>
          <div
            class={cn(bottomClass, moreStatsBottomClass, valueClass)}
            aria-label={stats()?.raw.ariaLabel}
            data-balloon-pos="up"
          >
            {stats()?.raw.text ?? "-"}
          </div>
        </div>
        <div class="group key">
          <div class={topClass}>characters</div>
          <div
            class={cn(bottomClass, moreStatsBottomClass, valueClass)}
            aria-label={"correct\nincorrect\nextra\nmissed"}
            data-balloon-break=""
            data-balloon-pos="up"
          >
            {stats()?.characters ?? "-"}
          </div>
        </div>
        <div class="group consistency">
          <div class={topClass}>consistency</div>
          <div
            class={cn(bottomClass, moreStatsBottomClass, valueClass)}
            aria-label={stats()?.consistency.ariaLabel}
            data-balloon-pos="up"
          >
            {stats()?.consistency.text ?? "-"}
          </div>
        </div>
        <div class="group time">
          <div class={topClass}>time</div>
          <div
            class={cn(bottomClass, moreStatsBottomClass, valueClass)}
            aria-label={stats()?.time.ariaLabel}
            data-balloon-pos="up"
          >
            <div class="text">{stats()?.time.text ?? "-"}</div>
            <div class={cn("afk", subTextClass)}>{stats()?.time.afk}</div>
            <div class={cn("timeToday", subTextClass)}>
              {resultState.timeToday}
            </div>
          </div>
        </div>
        <ResultDailyLeaderboard
          topClass={topClass}
          bottomClass={cn(bottomClass, moreStatsBottomClass, valueClass)}
        />
        <div
          class={cn(
            "group source max-w-[30rem] max-md:col-span-full",
            stats()?.source === undefined && "hidden",
          )}
        >
          <div class={smallTopClass}>
            <span class="mr-[0.5em]">source</span>
            <ResultQuoteActions />
          </div>
          <div class={cn(smallBottomClass, moreStatsBottomClass)}>
            {stats()?.source ?? "-"}
          </div>
        </div>
      </div>
    </>
  );
}
