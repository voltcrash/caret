import type { EventLog } from "@oxytype/typing-core/events/types";

import {
  getKeypressDurations,
  getKeypressSpacing,
} from "@oxytype/typing-core/events/stats";
import { createMemo, JSXElement, Show } from "solid-js";

import {
  getScatterOpen,
  setScatterOpen,
} from "../../../states/event-log-viewer";
import { Balloon } from "../../common/Balloon";
import { Button } from "../../common/Button";
import {
  getCharPositionPoints,
  getHoldFlightPoints,
  getIndexPoints,
  getInsertKeystrokes,
  getKeydownCodes,
  getLagPoints,
  getLognormalFit,
  getPerKeyPoints,
  percentileOf,
  type ScatterPoint,
} from "./scatter-points";
import { ScatterChart } from "./ScatterChart";

export function ScatterPanel(props: {
  ctx: EventLog;
  /** the whole log - only used to fix the axis bounds so they hold still */
  fullCtx: EventLog;
}): JSXElement {
  const open = getScatterOpen;
  const setOpen = setScatterOpen;

  const spacing = createMemo(() => getKeypressSpacing(props.ctx));
  const durations = createMemo(() => getKeypressDurations(props.ctx));

  // axes come from the whole log so points fill into a fixed frame instead of
  // the scales lurching about with three points on screen
  const allSpacing = createMemo(() => getKeypressSpacing(props.fullCtx));
  const allDurations = createMemo(() => getKeypressDurations(props.fullCtx));

  const keydownCodes = createMemo(() => getKeydownCodes(props.ctx.events));

  const inserts = createMemo(() => getInsertKeystrokes(props.ctx.events));

  const lagPoints = (): ScatterPoint[] => getLagPoints(spacing());

  const indexPoints = (): ScatterPoint[] => getIndexPoints(spacing());

  const holdFlightPoints = (): ScatterPoint[] =>
    getHoldFlightPoints(spacing(), durations());

  const lognormalFit = createMemo(() => getLognormalFit(spacing()));

  const charPositionPoints = (): ScatterPoint[] =>
    getCharPositionPoints(inserts());

  const holdPerKey = createMemo(() =>
    getPerKeyPoints(durations(), keydownCodes()),
  );
  const spacingPerKey = createMemo(() =>
    getPerKeyPoints(spacing(), keydownCodes()),
  );

  const spacingUpper = (): number => percentileOf(allSpacing(), 0.95);
  const durationUpper = (): number =>
    percentileOf(
      allDurations().filter((d) => d > 0),
      0.98,
    );

  return (
    <div class="bg-bg-secondary flex shrink-0 flex-col gap-2 rounded-lg p-3">
      <div class="flex items-center justify-between">
        <Balloon
          class="cursor-help text-xs tracking-wider text-sub uppercase"
          text="Scatter views of the same key timing. These read as shape rather than numbers - they get useful around 500 keystrokes (a 60s test) and are only suggestive on a short one."
          position="up"
          length="xlarge"
          break
        >
          Timing scatter ({spacing().length} keystrokes)
        </Balloon>
        <Button
          variant="text"
          fa={{ icon: open() ? "fa-chevron-up" : "fa-chevron-down" }}
          balloon={{ text: open() ? "Collapse" : "Expand" }}
          onClick={() => setOpen(!open())}
        />
      </div>
      <Show when={open()}>
        <div class="grid max-h-[50vh] grid-cols-1 gap-3 overflow-auto md:grid-cols-2 xl:grid-cols-3">
          <ScatterChart
            title="1. lag plot"
            balloon="Each gap against the one after it. Human typing is autocorrelated - slow keys follow slow keys - so the cloud tilts along the diagonal. An independent random generator gives a round featureless blob, and a timer driven one gives a visible grid of dots because both axes only take discrete values."
            points={lagPoints()}
            xTitle="spacing i (ms)"
            yTitle="spacing i+1 (ms)"
            xMax={spacingUpper()}
            yMax={spacingUpper()}
          />
          <ScatterChart
            title="2. spacing over time"
            balloon="Every gap in order. Humans drift - warming up, tiring, pausing - so the band wanders and throws isolated spikes. A bot draws a flat ribbon of constant thickness, and a timer driven one shows horizontal striping where values land on discrete levels."
            points={indexPoints()}
            xTitle="keystroke"
            yTitle="spacing (ms)"
            yMax={percentileOf(allSpacing(), 0.98)}
          />
          <ScatterChart
            title="3. hold vs flight"
            balloon="How long each key was held against the gap that followed it. Points above the dashed line are genuine rollover - the next key went down before this one came up - which is where keyOverlap comes from. Fast typists live above the line. A constant hold generator draws a flat horizontal band."
            points={holdFlightPoints()}
            xTitle="spacing to next key (ms)"
            yTitle="hold (ms)"
            xMax={spacingUpper()}
            yMax={durationUpper()}
            identityLine
          />
          <ScatterChart
            title="4. hold per key"
            balloon="One column of hold times per physical key, in keyboard order, for keys pressed at least 3 times. Humans show real structure - home row tighter and faster than the outer keys. A generator makes every column statistically identical, which is hard to fake without a per key model."
            points={holdPerKey().points}
            xTitle="key"
            yTitle="hold (ms)"
            yMax={durationUpper()}
            xTickLabels={holdPerKey().labels}
          />
          <ScatterChart
            title={`5. Q-Q vs lognormal${lognormalFit().sigma === null ? "" : ` (σ ${(lognormalFit().sigma as number).toFixed(2)})`}`}
            balloon="Observed spacing against what a lognormal with the same log mean and log spread predicts. Sigma in the title is the spread of that fit, on a log scale - human key spacing runs about 0.3 to 0.7. A straight line along the dashed diagonal means the fit describes the data; systematic curves away from it show exactly where the shape departs, and a step means two different mechanisms are mixed together."
            points={lognormalFit().points}
            xTitle="lognormal quantile (ms)"
            yTitle="observed (ms)"
            xMax={percentileOf(allSpacing(), 0.98)}
            yMax={percentileOf(allSpacing(), 0.98)}
            identityLine
          />
          <ScatterChart
            title="6. spacing by char position"
            balloon="Time to type each character against its position in the word. Humans show a clear spike at position 0 - word initiation costs real time - decaying across the word. A per character loop knows nothing about word boundaries, so it draws a flat band."
            points={charPositionPoints()}
            xTitle="char index in word"
            yTitle="spacing (ms)"
            yMax={percentileOf(allSpacing(), 0.98)}
          />
          <ScatterChart
            title="7. spacing per key"
            balloon="One column of gaps per physical key, in keyboard order, for keys pressed at least 3 times. This is the gap that follows each key, so it reads as how long that key takes to move away from rather than how long it is held. Expect far more structure than the hold version: the cost depends on what comes next, so a key reached by an awkward same hand digraph sits high while one that alternates hands sits low. A generator draws every gap from one distribution regardless of which key it just pressed, making every column the same."
            points={spacingPerKey().points}
            xTitle="key"
            yTitle="spacing to next key (ms)"
            yMax={spacingUpper()}
            xTickLabels={spacingPerKey().labels}
          />
        </div>
      </Show>
    </div>
  );
}
