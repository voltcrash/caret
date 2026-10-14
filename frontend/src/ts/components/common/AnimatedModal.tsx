import { animate, AnimationParams as AnimeParams } from "animejs";
import { JSXElement, ParentProps, Show, onCleanup, onMount } from "solid-js";

import { createEffectOn } from "../../hooks/effects";
import { useRef } from "../../hooks/useRef";
import {
  ModalId,
  isModalChained,
  isModalOpen,
  hideModal as storeHideModal,
} from "../../states/modals";
import { registerOverlayVisibility } from "../../states/overlay-visibility";
import { cn } from "../../utils/cn";
import { applyReducedMotion } from "../../utils/misc";

type AnimationParams = {
  opacity?: number | [number, number];
  marginTop?: string | [string, string];
  marginRight?: string | [string, string];
  duration?: number;
};

type AnimationConfig = {
  wrapper?: AnimationParams;
  modal?: AnimationParams;
};

type AnimatedModalProps = ParentProps<{
  id: ModalId;
  domId?: string;
  mode?: "modal" | "dialog";
  animationMode?: "none" | "both" | "modalOnly";
  customAnimations?: {
    show?: AnimationConfig;
    hide?: AnimationConfig;
  };
  focusFirstInput?: true | "focusAndSelect";
  beforeShow?: (isChained: boolean) => void | Promise<void>;
  afterShow?: () => void | Promise<void>;
  beforeHide?: () => void | Promise<void>;
  afterHide?: () => void | Promise<void>;
  onEscape?: (e: KeyboardEvent) => void;
  onBackdropClick?: (e: MouseEvent) => void;
  onScroll?: (e: Event) => void;

  closeOnWrapperClick?: boolean;
  closeOnEscape?: boolean;

  /**
   * Below the sm breakpoint (phones) present as a bottom sheet instead of a
   * centered card. Defaults to true; set false for panels with their own
   * mobile layout.
   */
  mobileSheet?: boolean;

  title?: string;
  modalClass?: string;
  wrapperClass?: string;
}>;

function setStyle(
  element: HTMLElement | undefined,
  style: Record<string, string>,
): void {
  if (element) Object.assign(element.style, style);
}

function animateElement(
  element: HTMLElement | undefined,
  options: AnimeParams,
): void {
  if (element) animate(element, options);
}

const DEFAULT_ANIMATION_DURATION = 125;
const SHEET_ANIMATION_DURATION = 200;
const MODAL_ONLY_ANIMATION_MULTIPLIER = 0.75;
const SHEET_MEDIA_QUERY = "(max-width: 720.98px)";
// how far a sheet has to be dragged down by its handle to close
const SHEET_DISMISS_DRAG_PX = 80;
// or flicked down faster than this (px per ms), past tap jitter
const SHEET_DISMISS_VELOCITY = 0.5;
const SHEET_FLICK_MIN_PX = 16;

type ModalMotion = {
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

function isSheetViewport(): boolean {
  return matchMedia?.(SHEET_MEDIA_QUERY)?.matches;
}

export function AnimatedModal(props: AnimatedModalProps): JSXElement {
  // Refs are assigned by SolidJS via the ref attribute
  const [dialogRef, dialogEl] = useRef<HTMLDialogElement>();
  const [modalRef, modalEl] = useRef<HTMLDivElement>();
  let returnFocus: HTMLElement | undefined;
  onMount(() => {
    const unregister = registerOverlayVisibility(
      () => (dialogEl()?.getClientRects().length ?? 0) > 0,
    );
    onCleanup(unregister);
  });

  const visibility = (): boolean => isModalOpen(props.id);

  const usesSheetAnimation = (): boolean =>
    props.mobileSheet !== false && isSheetViewport();

  // swipe the sheet down by its handle to close it, like native sheets
  let dragStartY: number | undefined;
  let dragStartTime = 0;
  let dragOffset = 0;

  const resetSheetDrag = (): void => {
    dragStartY = undefined;
    animateElement(modalEl(), {
      translateY: [`${dragOffset}px`, "0px"],
      duration: applyReducedMotion(DEFAULT_ANIMATION_DURATION),
    });
    dragOffset = 0;
  };

  const onHandlePointerDown = (e: PointerEvent): void => {
    if (!usesSheetAnimation() || props.closeOnWrapperClick === false) return;
    dragStartY = e.clientY;
    dragStartTime = e.timeStamp;
    dragOffset = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onHandlePointerMove = (e: PointerEvent): void => {
    if (dragStartY === undefined) return;
    dragOffset = Math.max(0, e.clientY - dragStartY);
    setStyle(modalEl(), { transform: `translateY(${dragOffset}px)` });
  };

  const onHandlePointerUp = (e: PointerEvent): void => {
    if (dragStartY === undefined) return;
    dragStartY = undefined;
    const velocity = dragOffset / Math.max(1, e.timeStamp - dragStartTime);
    if (
      dragOffset >= SHEET_DISMISS_DRAG_PX ||
      (dragOffset >= SHEET_FLICK_MIN_PX && velocity >= SHEET_DISMISS_VELOCITY)
    ) {
      if (props.onBackdropClick) {
        props.onBackdropClick(e);
      } else {
        storeHideModal(props.id);
      }
      if (visibility()) resetSheetDrag();
      return;
    }
    resetSheetDrag();
  };

  const onHandlePointerCancel = (): void => {
    if (dragStartY !== undefined) resetSheetDrag();
  };

  // Handle open/close with animations
  createEffectOn(
    visibility,
    (visible) => {
      const isChained = isModalChained(props.id);

      if (visible) {
        void showModal(isChained);
      } else if (dialogEl()?.open) {
        void hideModal(isChained);
      }
    },
    {},
  );

  const showModal = async (isChained: boolean): Promise<void> => {
    if (dialogEl() === undefined || modalEl() === undefined) return;
    if (dialogEl()?.open) return;

    if (!isChained && document.activeElement instanceof HTMLElement) {
      returnFocus = document.activeElement;
    }

    await props.beforeShow?.(isChained);

    // After await, the element may have been removed from the DOM
    if (!dialogEl()?.isConnected || !visibility()) return;

    // Open the dialog
    const dialog = dialogEl();
    if (dialog) dialog.style.cssText = "";
    if (props.mode === "dialog") {
      dialogEl()?.show();
    } else {
      dialogEl()?.showModal();
    }

    const sheet = usesSheetAnimation();
    const motion = sheet ? SHEET_MOTION : CARD_MOTION;
    const modalAnimDuration = applyReducedMotion(
      (props.customAnimations?.show?.modal?.duration ??
        (sheet ? SHEET_ANIMATION_DURATION : DEFAULT_ANIMATION_DURATION)) *
        (isChained ? MODAL_ONLY_ANIMATION_MULTIPLIER : 1),
    );

    const animMode = isChained ? "modalOnly" : (props.animationMode ?? "both");

    // Animate in
    if (animMode === "both" || animMode === "none") {
      const wrapperDuration = applyReducedMotion(
        props.customAnimations?.show?.wrapper?.duration ??
          DEFAULT_ANIMATION_DURATION,
      );

      // Wrapper animation
      if (animMode !== "none") {
        animateElement(dialogEl(), {
          opacity: [0, 1],
          duration: wrapperDuration,
          ease: "easeOut",
        });
      }

      // Modal animation
      if (animMode !== "none") {
        const customModal = props.customAnimations?.show?.modal;
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
        setStyle(modalEl(), initialStyle);

        animateElement(modalEl(), {
          ...animParams,
          duration: modalAnimDuration,
          easing: "ease-out",
          fill: "forwards",
          onComplete: () => {
            focusFirstInput();
            void handleAfterShow();
          },
        });
      } else {
        setStyle(modalEl(), {
          opacity: "1",
          marginTop: "0",
        });
        focusFirstInput();
        void handleAfterShow();
      }
    } else if (animMode === "modalOnly") {
      setStyle(dialogEl(), {
        opacity: "1",
      });

      setStyle(modalEl(), motion.enter.style);
      animateElement(modalEl(), {
        ...motion.enter.params,
        duration: modalAnimDuration,
        onComplete: () => {
          focusFirstInput();
          void handleAfterShow();
        },
      });
    }
  };

  const hideModal = async (isChained: boolean): Promise<void> => {
    // Guard: only hide if visible and not already animating
    if (dialogEl() === undefined || modalEl() === undefined) return;

    await props.beforeHide?.();

    const sheet = usesSheetAnimation();
    // a dragged sheet slides out from where the finger let go
    const motion: ModalMotion =
      sheet && dragOffset > 0
        ? {
            ...SHEET_MOTION,
            exit: { translateY: [`${dragOffset}px`, "100%"] },
          }
        : sheet
          ? SHEET_MOTION
          : CARD_MOTION;
    dragOffset = 0;
    const modalAnimDuration = applyReducedMotion(
      (props.customAnimations?.hide?.modal?.duration ??
        (sheet ? SHEET_ANIMATION_DURATION : DEFAULT_ANIMATION_DURATION)) *
        (isChained ? MODAL_ONLY_ANIMATION_MULTIPLIER : 1),
    );

    const animMode = isChained ? "modalOnly" : (props.animationMode ?? "both");

    if (animMode === "both" || animMode === "none") {
      const wrapperDuration = applyReducedMotion(
        props.customAnimations?.hide?.wrapper?.duration ??
          DEFAULT_ANIMATION_DURATION,
      );

      // Modal animation
      if (animMode !== "none") {
        const customModal = props.customAnimations?.hide?.modal;
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
        animateElement(modalEl(), {
          ...hideAnimParams,
          duration: modalAnimDuration,
        });

        animateElement(dialogEl(), {
          opacity: [1, 0],
          duration: wrapperDuration,
          onComplete: async () => {
            await closeDialog(isChained);
          },
        });
      } else {
        await closeDialog(isChained);
      }
    } else if (animMode === "modalOnly") {
      animateElement(modalEl(), {
        ...motion.exit,
        duration: modalAnimDuration,
        onComplete: async () => {
          await closeDialog(isChained);
        },
      });
    }
  };

  const handleAfterHide = async (): Promise<void> => {
    await props.afterHide?.();
    storeHideModal(props.id);
  };

  const closeDialog = async (isChained: boolean): Promise<void> => {
    dialogEl()?.close();
    await handleAfterHide();
    if (
      !isChained &&
      returnFocus?.isConnected &&
      document.querySelector("dialog[open]") === null
    ) {
      returnFocus.focus({ preventScroll: true });
    }
  };

  const handleAfterShow = async (): Promise<void> => {
    await props.afterShow?.();
  };

  const focusFirstInput = (): void => {
    if (modalEl() === undefined || dialogEl() === undefined) return;
    if (!visibility() || !dialogEl()?.open) return;
    if (props.focusFirstInput === undefined) {
      // Native modal dialogs select their initial focus. Keep it unless the
      // content contains no focusable control; then focus its owned container.
      if (!modalEl()?.contains(document.activeElement)) modalEl()?.focus();
      return;
    }

    const input = modalEl()?.querySelector<
      HTMLInputElement | HTMLTextAreaElement
    >(
      "input:not([type=hidden]):not([disabled]):not(.hidden), textarea:not([disabled]):not(.hidden)",
    );
    if (input) {
      if (props.focusFirstInput === true) {
        input.focus();
      } else if (props.focusFirstInput === "focusAndSelect") {
        input.focus();
        input.select();
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent): void => {
    if (
      e.key === "Tab" &&
      !e.defaultPrevented &&
      visibility() &&
      props.mode !== "dialog"
    ) {
      const focusable = Array.from(
        modalEl()?.querySelectorAll<HTMLElement>(
          "button, a[href], input, textarea, select, [tabindex]",
        ) ?? [],
      ).filter(
        (element) =>
          element.tabIndex >= 0 &&
          !element.hasAttribute("disabled") &&
          element.getClientRects().length > 0,
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first === undefined) {
        e.preventDefault();
        modalEl()?.focus();
      } else if (
        e.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === modalEl())
      ) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    if (e.key === "Escape" && visibility()) {
      if (props.closeOnEscape === false) return;
      e.preventDefault();
      e.stopPropagation();
      if (props.onEscape) {
        props.onEscape(e);
      } else {
        storeHideModal(props.id);
      }
    }
  };

  const handleBackdropClick = (e: MouseEvent): void => {
    if (props.closeOnWrapperClick === false) return;
    if (e.target === dialogEl()) {
      if (props.onBackdropClick) {
        props.onBackdropClick(e);
      } else {
        storeHideModal(props.id);
      }
    }
  };

  onCleanup(() => {
    if (dialogEl()?.open) {
      dialogEl()?.close();
    }
  });

  return (
    <dialog
      aria-label={
        props.title ?? (props.id as string).replace(/([a-z])([A-Z])/g, "$1 $2")
      }
      aria-modal={props.mode === "dialog" ? undefined : true}
      id={props.domId ?? `${props.id as string}Modal`}
      ref={dialogRef}
      class={cn(
        "fixed top-0 left-0 z-1000 m-0 hidden max-h-dvh max-w-screen border-none bg-[rgba(0,0,0,0.5)] backdrop:bg-transparent outline-none",
        // Native open state survives reactive wrapperClass updates after hide.
        "h-dvh w-full justify-center open:flex",
        props.mobileSheet === false
          ? "items-center p-2 xs:p-4 sm:p-8"
          : "items-end p-0 sm:items-center sm:p-8",
        props.wrapperClass,
      )}
      onKeyDown={handleKeyDown}
      onMouseDown={handleBackdropClick}
    >
      {/*
      Don't show the modal content on non-visible modals.
      If the modal contains data from e.g. a collection the collection would init on page load instead of when it is needed.
      */}
      <Show when={isModalOpen(props.id)}>
        <div
          class={cn(
            "modal pointer-events-auto grid outline-none h-max w-full max-w-md gap-4 overflow-auto overscroll-y-none bg-bg p-4 text-text ring-4 ring-sub-alt sm:p-8",
            props.mobileSheet === false
              ? "max-h-full rounded-double"
              : "sm:max-h-full sm:rounded-double max-sm:max-h-[85dvh] max-sm:rounded-t-[calc(var(--roundness)*2)] max-sm:rounded-b-none max-sm:pb-[max(1rem,env(safe-area-inset-bottom))]",
            props.modalClass,
          )}
          ref={modalRef}
          tabIndex={-1}
          onScroll={(e) => props.onScroll?.(e)}
        >
          <Show when={props.mobileSheet !== false}>
            <div
              aria-hidden="true"
              class="-mx-4 -mt-4 -mb-2 grid shrink-0 touch-none place-items-center py-3 sm:hidden"
              onPointerDown={onHandlePointerDown}
              onPointerMove={onHandlePointerMove}
              onPointerUp={onHandlePointerUp}
              onPointerCancel={onHandlePointerCancel}
            >
              <div class="h-1.5 w-10 rounded-full bg-sub-alt"></div>
            </div>
          </Show>
          <Show when={props.title !== undefined && props.title !== ""}>
            <div class="text-xl text-sub sm:text-2xl">{props.title}</div>
          </Show>
          {props.children}
        </div>
      </Show>
    </dialog>
  );
}
