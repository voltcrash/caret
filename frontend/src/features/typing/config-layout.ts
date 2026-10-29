import { cn } from "../../ts/utils/cn";

export const variables = cn(
  "[--card-gap:0.25em] [--font-size:0.5em] [--horizontal-padding:0.4em] [--vertical-padding:0.5rem]",
  "md:[--card-gap:1em] md:[--font-size:0.6em] md:[--horizontal-padding:0.45em] md:[--vertical-padding:0.75rem]",
  "lg:[--card-gap:1em] lg:[--font-size:0.75em] lg:[--horizontal-padding:0.5em] lg:[--vertical-padding:0.75rem]",
  "xl:[--card-gap:2em] xl:[--font-size:0.75em] xl:[--horizontal-padding:1em] xl:[--vertical-padding:0.75rem]",
);
export const buttonClass = "px-(--horizontal-padding) py-(--vertical-padding)";
export const cardClass =
  "card rounded-(--roundness) bg-sub-alt px-(--horizontal-padding)";
