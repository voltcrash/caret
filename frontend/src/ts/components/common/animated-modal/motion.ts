import { animate, AnimationParams as AnimeParams } from "animejs";

import { applyReducedMotion } from "../../../utils/misc";

type AnimationParams = {
  opacity?: number | [number, number];
  marginTop?: string | [string, string];
  marginRight?: string | [string, string];
  duration?: number;
};

export type AnimationConfig = {
  wrapper?: AnimationParams;
  modal?: AnimationParams;
};

export function setStyle(
  element: HTMLElement | undefined,
  style: Record<string, string>,
): void {
  if (element) Object.assign(element.style, style);
}

export function animateElement(
  element: HTMLElement | undefined,
  options: AnimeParams,
): void {
  if (element) animate(element, options);
}

export const DEFAULT_ANIMATION_DURATION = 125;
const SHEET_ANIMATION_DURATION = 200;
const MODAL_ONLY_ANIMATION_MULTIPLIER = 0.75;
const SHEET_MEDIA_QUERY = "(max-width: 720.98px)";

export type ModalMotion = {
  enter: { style: Record<string, string>; params: Record<string, unknown> };
  exit: Record<string, unknown>;
};

const CARD_MOTION: ModalMotion = {
  enter: {
    style: { opacity: "0", marginTop: "1rem" },
    params: { opacity: [0, 1], marginTop: ["1rem", "0"] },
  },
  exit: { opacity: [1, 0], marginTop: ["0", "1rem"] },
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
  animParams: Record<string, unknown>;
} {
  const initialStyle: Record<string, string> = {
    ...motion.enter.style,
  };
  const animParams: Record<string, unknown> = {
    ...motion.enter.params,
  };
  if (customModal) {
    if (customModal.opacity !== undefined) {
      const v = customModal.opacity;
      initialStyle["opacity"] = String(Array.isArray(v) ? v[0] : v);
      animParams["opacity"] = v;
    }
    if (customModal.marginTop !== undefined) {
      const v = customModal.marginTop;
      initialStyle["marginTop"] = Array.isArray(v) ? v[0] : v;
      animParams["marginTop"] = v;
    }
    if (customModal.marginRight !== undefined) {
      const v = customModal.marginRight;
      initialStyle["marginRight"] = Array.isArray(v) ? v[0] : v;
      animParams["marginRight"] = v;
      delete initialStyle["marginTop"];
      delete animParams["marginTop"];
    }
  }
  return { initialStyle, animParams };
}

export function getExitAnimationParams(
  motion: ModalMotion,
  customModal: AnimationParams | undefined,
): Record<string, unknown> {
  const hideAnimParams: Record<string, unknown> = {
    ...motion.exit,
  };
  if (customModal) {
    if (customModal.opacity !== undefined) {
      hideAnimParams["opacity"] = customModal.opacity;
    }
    if (customModal.marginTop !== undefined) {
      hideAnimParams["marginTop"] = customModal.marginTop;
    }
    if (customModal.marginRight !== undefined) {
      hideAnimParams["marginRight"] = customModal.marginRight;
      delete hideAnimParams["marginTop"];
    }
  }
  return hideAnimParams;
}
