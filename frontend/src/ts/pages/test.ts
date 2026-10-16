import {
  enterTypingRoute,
  exitTypingRoute,
} from "../../features/typing/lifecycle";
import Page from "./page";
import { blurInputElement } from "../input/input-element";

/** Rollback adapter: the cached page runs the typing route's commands. */
export const page = new Page({
  id: "test",
  path: "/",
  beforeHide: async (): Promise<void> => {
    blurInputElement();
  },
  afterHide: async (): Promise<void> => {
    exitTypingRoute();
  },
  beforeShow: async (): Promise<void> => {
    void enterTypingRoute().catch((error: unknown) =>
      console.error("Typing initialization failed", error),
    );
  },
});
