import { createAppSignal } from "../../app/state";

export type BreakpointKey = "xxl" | "xl" | "lg" | "md" | "sm" | "xs" | "xxs";
export type Breakpoints = Record<BreakpointKey, boolean>;

export const [bp, setBreakpoints] = createAppSignal<Breakpoints>({
  xxl: false,
  xl: false,
  lg: false,
  md: false,
  sm: false,
  xs: false,
  xxs: false,
});
