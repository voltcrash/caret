import { createAppSignal } from "../../app/state";
import { JSX } from "solid-js";

export const [getBackground, setBackground] = createAppSignal({ url: "" });
export const [getBackgroundStyle, setBackgroundStyle] =
  createAppSignal<JSX.CSSProperties>({});
export const [getBackgroundSize, setBackgroundSize] = createAppSignal<
  "" | "cover" | "contain"
>("");
