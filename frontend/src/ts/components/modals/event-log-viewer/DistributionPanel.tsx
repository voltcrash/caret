import type { EventLog } from "@caret/web-shared/events/types";

import { createMemo, JSXElement, Show } from "solid-js";

import {
  getKeypressDurations,
  getKeypressSpacing,
} from "../../../../features/typing/analysis.client";
import { requireBrowserAudit } from "../../../../features/typing/audit.client";
import {
  getDistributionOpen,
  setDistributionOpen,
} from "../../../states/event-log-viewer";
import { Balloon } from "../../common/Balloon";
import { Button } from "../../common/Button";
import { DistributionChart } from "./DistributionChart";
import { Stat } from "./Stat";
import { formatPercent, formatSignificant, formatSigmas } from "./stat-format";

export function DistributionPanel(props: {
  ctx: EventLog;
  /** the whole log - only used to pin the bucket scale so it holds still */
  fullCtx: EventLog;
}): JSXElement {
  const spacing = createMemo(() => getKeypressSpacing(props.ctx));
  // durations are seeded with a 0 placeholder on keydown and filled in on
  // keyup, so a leftover 0 means the key was never released. mid playback that
  // also covers the key currently being held
  const durationsRaw = createMemo(() => getKeypressDurations(props.ctx));
  const unreleased = (): number => durationsRaw().filter((d) => d === 0).length;
  const durations = createMemo(() => durationsRaw().filter((d) => d > 0));

  const allSpacing = createMemo(() => getKeypressSpacing(props.fullCtx));
  const allDurations = createMemo(() =>
    getKeypressDurations(props.fullCtx).filter((d) => d > 0),
  );

  // these need both arrays at once, so they sit under the two charts rather
  // than inside either. durationsRaw keeps its 0 placeholders here on purpose -
  // dropping them would shift every later index out of alignment with spacing
  const audit = requireBrowserAudit();
  const cross = createMemo(() => audit.cross(spacing(), durationsRaw()));

  const open = getDistributionOpen;
  const setOpen = setDistributionOpen;

  return (
    <div class="bg-bg-secondary flex shrink-0 flex-col gap-2 rounded-lg p-3">
      <div class="flex items-center justify-between">
        <Balloon
          class="cursor-help text-xs tracking-wider text-sub uppercase"
          text="Hover any stat for what it measures and what human versus generated data looks like. Red means the value sits below the human range and is worth a look; amber on n means the sample is too small to flag anything. Every threshold is one sided - nothing above the human range is suspicious, a long tail is just someone thinking."
          position="up"
          length="xlarge"
          break
        >
          Key timing distribution
        </Balloon>
        <Button
          variant="text"
          fa={{ icon: open() ? "fa-chevron-up" : "fa-chevron-down" }}
          balloon={{ text: open() ? "Collapse" : "Expand" }}
          onClick={() => setOpen(!open())}
        />
      </div>
      <Show when={open()}>
        <div class="flex flex-wrap gap-3">
          <DistributionChart
            label="keySpacing"
            kind="spacing"
            values={spacing()}
            scaleValues={allSpacing()}
          />
          <DistributionChart
            label="keyDuration"
            kind="duration"
            values={durations()}
            scaleValues={allDurations()}
            note={
              unreleased() > 0
                ? `${unreleased()} unreleased excluded`
                : undefined
            }
          />
        </div>
        <div class="flex flex-wrap gap-x-3 gap-y-1 border-t border-bg pt-2 font-mono text-xs">
          <span class="text-sub">keySpacing × keyDuration</span>
          <Stat
            label="xcorr0"
            value={formatSignificant(cross().lag0)}
            balloon="Correlation between how long a key was held and the gap that followed it, on logs. The two arrays are index aligned - duration[i] and spacing[i] describe the same keypress - so one shared speed state in a hand should couple them. A generator drawing the two arrays from separate distributions sits at zero. Not flagged: the generator side is exact but nobody has measured the human side yet."
          />
          <Stat
            label="xcorr1"
            value={formatSignificant(cross().lag1)}
            balloon="The same correlation shifted by one key: the gap before a key against that key's hold. This is the part that is awkward to fake. Matching a single correlation is easy; being non zero at several lags at once needs the two series to actually come from one process rather than two."
          />
          <Stat
            label="overlap"
            value={formatPercent(cross().overlapRate)}
            balloon="Share of keypresses still held when the next key went down - genuine rollover, derived from duration[i] > spacing[i]. Rollover is not optional at speed: gaps shrink as 12000/wpm while holds stay near 70ms, so most keystrokes must overlap at 200wpm and almost none at 60wpm. A fast result with no overlap describes a physically impossible hand."
          />
          <Stat
            label="ovl runs"
            value={formatSigmas(cross().overlapRunsZ)}
            balloon="Runs test on that overlap series. Rolling comes in bursts - through a familiar sequence you roll, elsewhere you do not - so the binary series should clump, giving a negative z. A generator whose holds and gaps are independent produces overlaps at random and sits near zero. Being binary this gets the exact runs test null for free."
          />
        </div>
      </Show>
    </div>
  );
}
