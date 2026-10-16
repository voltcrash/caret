import * as TestLogic from "../../features/typing/runtime/test-logic";
import * as Funbox from "../../features/typing/runtime/funbox/funbox";
import Page from "./page";
import { blurInputElement } from "../input/input-element";
import { resetIncompleteTests } from "../states/test";

export const page = new Page({
  id: "test",
  path: "/",
  beforeHide: async (): Promise<void> => {
    blurInputElement();
  },
  afterHide: async (): Promise<void> => {
    void TestLogic.restart({
      noAnim: true,
    });
    void Funbox.clear();
  },
  beforeShow: async (): Promise<void> => {
    resetIncompleteTests();
    void TestLogic.restart({
      noAnim: true,
    });
  },
});
