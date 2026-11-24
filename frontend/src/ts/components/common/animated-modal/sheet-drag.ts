import { applyReducedMotion } from "../../../utils/misc";
import { animateElement, DEFAULT_ANIMATION_DURATION, setStyle } from "./motion";

// how far a sheet has to be dragged down by its handle to close
const SHEET_DISMISS_DRAG_PX = 80;
// or flicked down faster than this (px per ms), past tap jitter
const SHEET_DISMISS_VELOCITY = 0.5;
const SHEET_FLICK_MIN_PX = 16;

type SheetDrag =
  | { phase: "tracking"; startY: number; startTime: number; offset: number }
  | { phase: "released"; offset: number };

export type SheetDragHandle = {
  onPointerDown: (e: PointerEvent) => void;
  onPointerMove: (e: PointerEvent) => void;
  onPointerUp: (e: PointerEvent) => void;
  onPointerCancel: () => void;
  /** Ends the gesture and returns how far the sheet was dragged. */
  release: () => number;
};

/**
 * Swipe the sheet down by its handle to close it, like native sheets.
 * State lives in the returned handle, one per modal instance.
 */
export function createSheetDrag(options: {
  modal: () => HTMLElement | undefined;
  canDrag: () => boolean;
  isOpen: () => boolean;
  dismiss: (e: PointerEvent) => void;
}): SheetDragHandle {
  let drag: SheetDrag | undefined;

  const resetSheetDrag = (offset: number): void => {
    drag = undefined;
    animateElement(options.modal(), {
      translateY: [`${offset}px`, "0px"],
      duration: applyReducedMotion(DEFAULT_ANIMATION_DURATION),
    });
  };

  return {
    onPointerDown: (e) => {
      if (!options.canDrag()) return;
      drag = {
        phase: "tracking",
        startY: e.clientY,
        startTime: e.timeStamp,
        offset: 0,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    onPointerMove: (e) => {
      if (drag?.phase !== "tracking") return;
      drag.offset = Math.max(0, e.clientY - drag.startY);
      setStyle(options.modal(), {
        transform: `translateY(${drag.offset}px)`,
      });
    },
    onPointerUp: (e) => {
      if (drag?.phase !== "tracking") return;
      const { offset, startTime } = drag;
      drag = { phase: "released", offset };
      const velocity = offset / Math.max(1, e.timeStamp - startTime);
      if (
        offset >= SHEET_DISMISS_DRAG_PX ||
        (offset >= SHEET_FLICK_MIN_PX && velocity >= SHEET_DISMISS_VELOCITY)
      ) {
        options.dismiss(e);
        if (options.isOpen()) resetSheetDrag(offset);
        return;
      }
      resetSheetDrag(offset);
    },
    onPointerCancel: () => {
      if (drag?.phase === "tracking") resetSheetDrag(drag.offset);
    },
    release: () => {
      const offset = drag?.offset ?? 0;
      drag = undefined;
      return offset;
    },
  };
}
