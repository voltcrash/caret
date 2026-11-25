import { Accessor, onCleanup } from "solid-js";

import { updateClassNames } from "../utils/cn";
import { applyReducedMotion } from "../utils/misc";
import { createEffectOn } from "./effects";

const CLEARED_SLIDE_STYLES = {
  height: "",
  marginTop: "",
  marginBottom: "",
  paddingTop: "",
  paddingBottom: "",
  overflow: "",
};

export function useSlideAnimation(options: {
  element: Accessor<HTMLElement | undefined>;
  visible: Accessor<boolean>;
  duration: Accessor<number>;
}): void {
  let animation: Animation | undefined;

  const cancel = (): void => {
    animation?.cancel();
    animation = undefined;
  };

  createEffectOn(
    options.visible,
    (visible) => {
      const el = options.element();
      if (!el) return;

      cancel();

      const duration = applyReducedMotion(options.duration());
      if (duration <= 0) {
        el.className = updateClassNames(el.className, "hidden", !visible);
        Object.assign(el.style, CLEARED_SLIDE_STYLES);
        return;
      }

      el.className = updateClassNames(el.className, "hidden", false);
      Object.assign(el.style, CLEARED_SLIDE_STYLES, { overflow: "hidden" });
      const { height, marginTop, marginBottom, paddingTop, paddingBottom } =
        getComputedStyle(el);

      const current = el.animate(
        {
          height: visible ? ["0px", height] : [height, "0px"],
          marginTop: visible ? ["0px", marginTop] : [marginTop, "0px"],
          marginBottom: visible ? ["0px", marginBottom] : [marginBottom, "0px"],
          paddingTop: visible ? ["0px", paddingTop] : [paddingTop, "0px"],
          paddingBottom: visible
            ? ["0px", paddingBottom]
            : [paddingBottom, "0px"],
        },
        { duration, easing: "ease-out" },
      );
      animation = current;

      void current.finished.then(
        () => {
          if (animation !== current) return;
          animation = undefined;
          if (!visible) {
            el.className = updateClassNames(el.className, "hidden", true);
          }
          Object.assign(el.style, CLEARED_SLIDE_STYLES);
        },
        () => undefined,
      );
    },
    { defer: true },
  );

  onCleanup(cancel);
}
