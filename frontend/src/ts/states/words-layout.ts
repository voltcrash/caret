import { createAppSignal } from "../../app/state";
import { JSX } from "solid-js";
import { createEvent } from "../hooks/createEvent";

export const [getWordsWrapperHeight, setWordsWrapperHeight] =
  createAppSignal("");
export const [getWordsInputStyle, setWordsInputStyle] =
  createAppSignal<JSX.CSSProperties>({
    top: "0px",
    left: "0px",
    width: "",
    "max-width": "",
  });
export const centerWordsInputEvent = createEvent<boolean>();
