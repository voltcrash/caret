import { applyReducedMotion } from "../utils/misc";
import { animate, JSAnimation } from "animejs";
import { Accessor, onCleanup } from "solid-js";

import { createEffectOn } from "./effects";
import { updateClassNames } from "../utils/cn";

export function useSlideAnimation(options: {
  element: Accessor<HTMLElement | undefined>;
  visible: Accessor<boolean>;
  duration: Accessor<number>;
}): void {
  let animation: JSAnimation | undefined;
  createEffectOn(
    options.visible,
    (visible) => {
      const el = options.element();
      if (!el) return;
      const duration = applyReducedMotion(options.duration());
      if (!visible && duration === 0) {
        el.className = updateClassNames(el.className, "hidden", true);
        return;
      }
      el.className = updateClassNames(el.className, "hidden", false);
      const cleared = {
        height: "",
        marginTop: "",
        marginBottom: "",
        paddingTop: "",
        paddingBottom: "",
      };
      Object.assign(el.style, cleared, { overflow: "hidden" });
      const { height, marginTop, marginBottom, paddingTop, paddingBottom } =
        getComputedStyle(el);
      if (visible) {
        Object.assign(el.style, {
          height: "0px",
          marginTop: "0px",
          marginBottom: "0px",
          paddingTop: "0px",
          paddingBottom: "0px",
        });
      }
      animation = animate(el, {
        height: visible ? [0, height] : [height, 0],
        marginTop: visible ? [0, marginTop] : [marginTop, 0],
        marginBottom: visible ? [0, marginBottom] : [marginBottom, 0],
        paddingTop: visible ? [0, paddingTop] : [paddingTop, 0],
        paddingBottom: visible ? [0, paddingBottom] : [paddingBottom, 0],
        duration,
        onComplete: () => {
          if (visible) {
            Object.assign(el.style, {
              height: "",
              overflow: "",
              marginTop: "",
              marginBottom: "",
            });
          } else {
            el.className = updateClassNames(el.className, "hidden", true);
            Object.assign(el.style, cleared, { overflow: "" });
          }
        },
      });
    },
    { defer: true },
  );
  onCleanup(() => animation?.cancel());
}
