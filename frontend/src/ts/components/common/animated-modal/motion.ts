import { createAppOwned } from "../../../../app/application";
import { applyReducedMotion } from "../../../utils/misc";

type AnimationParams = {
  opacity?: number | [number, number];
  marginTop?: string | [string, string];
  marginRight?: string | [string, string];
  translateY?: string | [string, string];
  duration?: number;
};

export type AnimationConfig = {
  wrapper?: AnimationParams;
  modal?: AnimationParams;
};

export type ModalAnimationOptions = AnimationParams & {
  easing?: string;
  onComplete?: () => void | Promise<void>;
};

const activeAnimations = createAppOwned(
  () => new WeakMap<HTMLElement, Animation>(),
);

export function setStyle(
  element: HTMLElement | undefined,
  style: Record<string, string>,
): void {
  if (element) Object.assign(element.style, style);
}

export function cancelElementAnimation(element: HTMLElement | undefined): void {
  if (!element) return;
  const animations = activeAnimations();
  const running = animations.get(element);
  if (running !== undefined) {
    running.cancel();
    animations.delete(element);
  }
}

function resolveTuple<T extends string | number>(
  value: T | [T, T],
  fallbackFrom: string,
  format: (v: T) => string,
): [string, string] {
  if (Array.isArray(value)) {
    return [format(value[0]), format(value[1])];
  }
  return [fallbackFrom, format(value)];
}

export function animateElement(
  element: HTMLElement | undefined,
  options: ModalAnimationOptions,
): void {
  if (!element) return;

  cancelElementAnimation(element);

  const from: Keyframe = {};
  const to: Keyframe = {};
  const finalStyle: Record<string, string> = {};

  if (options.opacity !== undefined) {
    const [fromOpacity, toOpacity] = resolveTuple(
      options.opacity,
      element.style.opacity || "1",
      String,
    );
    from["opacity"] = fromOpacity;
    to["opacity"] = toOpacity;
    finalStyle["opacity"] = toOpacity;
  }

  if (options.translateY !== undefined) {
    const [fromY, toY] = resolveTuple(
      options.translateY,
      element.style.transform || "translateY(0px)",
      (v) => `translateY(${v})`,
    );
    from["transform"] = fromY;
    to["transform"] = toY;
    finalStyle["transform"] =
      toY === "translateY(0px)" || toY === "translateY(0%)" ? "" : toY;
  }

  if (options.marginTop !== undefined) {
    const [fromTop, toTop] = resolveTuple(
      options.marginTop,
      element.style.marginTop || "0px",
      String,
    );
    from["marginTop"] = fromTop;
    to["marginTop"] = toTop;
    finalStyle["marginTop"] = toTop;
  }

  if (options.marginRight !== undefined) {
    const [fromRight, toRight] = resolveTuple(
      options.marginRight,
      element.style.marginRight || "0px",
      String,
    );
    from["marginRight"] = fromRight;
    to["marginRight"] = toRight;
    finalStyle["marginRight"] = toRight;
  }

  const duration = options.duration ?? DEFAULT_ANIMATION_DURATION;
  Object.assign(element.style, finalStyle);

  if (duration <= 0 || Object.keys(to).length === 0) {
    void options.onComplete?.();
    return;
  }

  const animations = activeAnimations();
  const animation = element.animate([from, to], {
    duration,
    easing: options.easing ?? "ease-out",
  });
  animations.set(element, animation);
  void animation.finished.then(
    () => {
      if (animations.get(element) !== animation) return;
      animations.delete(element);
      void options.onComplete?.();
    },
    () => undefined,
  );
}

export const DEFAULT_ANIMATION_DURATION = 125;
const SHEET_ANIMATION_DURATION = 200;
const MODAL_ONLY_ANIMATION_MULTIPLIER = 0.75;
const SHEET_MEDIA_QUERY = "(max-width: 720.98px)";

export type ModalMotion = {
  enter: { style: Record<string, string>; params: AnimationParams };
  exit: AnimationParams;
};

const CARD_MOTION: ModalMotion = {
  enter: {
    style: { opacity: "0", transform: "translateY(1rem)" },
    params: { opacity: [0, 1], translateY: ["1rem", "0px"] },
  },
  exit: { opacity: [1, 0], translateY: ["0px", "1rem"] },
};

const SHEET_MOTION: ModalMotion = {
  enter: {
    style: { transform: "translateY(100%)" },
    params: { translateY: ["100%", "0%"] },
  },
  exit: { translateY: ["0%", "100%"] },
};

export function isSheetViewport(): boolean {
  return matchMedia?.(SHEET_MEDIA_QUERY)?.matches;
}

export function getShowMotion(sheet: boolean): ModalMotion {
  return sheet ? SHEET_MOTION : CARD_MOTION;
}

export function getHideMotion(sheet: boolean, dragOffset: number): ModalMotion {
  // a dragged sheet slides out from where the finger let go
  return sheet && dragOffset > 0
    ? {
        ...SHEET_MOTION,
        exit: { translateY: [`${dragOffset}px`, "100%"] },
      }
    : sheet
      ? SHEET_MOTION
      : CARD_MOTION;
}

export function getModalAnimationDuration(
  customDuration: number | undefined,
  sheet: boolean,
  isChained: boolean,
): number {
  return applyReducedMotion(
    (customDuration ??
      (sheet ? SHEET_ANIMATION_DURATION : DEFAULT_ANIMATION_DURATION)) *
      (isChained ? MODAL_ONLY_ANIMATION_MULTIPLIER : 1),
  );
}

export function getEnterAnimation(
  motion: ModalMotion,
  customModal: AnimationParams | undefined,
): {
  initialStyle: Record<string, string>;
  animParams: AnimationParams;
} {
  const initialStyle: Record<string, string> = {
    ...motion.enter.style,
  };
  const animParams: AnimationParams = {
    ...motion.enter.params,
  };
  if (customModal) {
    if (customModal.opacity !== undefined) {
      const v = customModal.opacity;
      initialStyle["opacity"] = String(Array.isArray(v) ? v[0] : v);
      animParams.opacity = v;
    }
    if (customModal.translateY !== undefined) {
      const v = customModal.translateY;
      initialStyle["transform"] = `translateY(${Array.isArray(v) ? v[0] : v})`;
      animParams.translateY = v;
    }
    if (customModal.marginTop !== undefined) {
      const v = customModal.marginTop;
      initialStyle["marginTop"] = Array.isArray(v) ? v[0] : v;
      animParams.marginTop = v;
      delete initialStyle["transform"];
      delete animParams.translateY;
    }
    if (customModal.marginRight !== undefined) {
      const v = customModal.marginRight;
      initialStyle["marginRight"] = Array.isArray(v) ? v[0] : v;
      animParams.marginRight = v;
      delete initialStyle["marginTop"];
      delete animParams.marginTop;
      delete initialStyle["transform"];
      delete animParams.translateY;
    }
  }
  return { initialStyle, animParams };
}

export function getExitAnimationParams(
  motion: ModalMotion,
  customModal: AnimationParams | undefined,
): AnimationParams {
  const hideAnimParams: AnimationParams = {
    ...motion.exit,
  };
  if (customModal) {
    if (customModal.opacity !== undefined) {
      hideAnimParams.opacity = customModal.opacity;
    }
    if (customModal.translateY !== undefined) {
      hideAnimParams.translateY = customModal.translateY;
    }
    if (customModal.marginTop !== undefined) {
      hideAnimParams.marginTop = customModal.marginTop;
      delete hideAnimParams.translateY;
    }
    if (customModal.marginRight !== undefined) {
      hideAnimParams.marginRight = customModal.marginRight;
      delete hideAnimParams.marginTop;
      delete hideAnimParams.translateY;
    }
  }
  return hideAnimParams;
}
