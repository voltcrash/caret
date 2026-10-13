import { JSXElement } from "solid-js";

export function SimulatedInputPanel(props: {
  /** everything typed up to the playhead, whitespace made visible */
  text: string;
}): JSXElement {
  return (
    <div class="bg-bg-secondary flex shrink-0 flex-col gap-2 rounded-lg p-3">
      <div class="text-xs tracking-wider text-sub uppercase">
        Simulated input
      </div>
      <div class="max-h-24 min-h-10 overflow-auto rounded bg-bg p-2 font-mono text-sm break-all whitespace-pre-wrap">
        {props.text}
      </div>
    </div>
  );
}
