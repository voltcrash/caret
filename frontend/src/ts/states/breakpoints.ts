import { createSignal } from "solid-js";

export type BreakpointKey = "xxl" | "xl" | "lg" | "md" | "sm" | "xs" | "xxs";
export type Breakpoints = Record<BreakpointKey, boolean>;

export const [bp, setBreakpoints] = createSignal<Breakpoints>({
  xxl: false,
  xl: false,
  lg: false,
  md: false,
  sm: false,
  xs: false,
  xxs: false,
});
