import { JSXElement, ParentProps, Show, onCleanup, onMount } from "solid-js";

import { createEffectOn } from "../../../hooks/effects";
import { useRef } from "../../../hooks/useRef";
import {
  ModalId,
  isModalChained,
  isModalOpen,
  hideModal as storeHideModal,
  completeModalHide,
  registerModalHost,
} from "../../../states/modals";
import { registerOverlayVisibility } from "../../../states/overlay-visibility";
import { cn } from "../../../utils/cn";
import { applyReducedMotion } from "../../../utils/misc";
import {
  focusModalContent,
  restoreModalFocus,
  trapModalTabFocus,
} from "./focus";
import {
  AnimationConfig,
  animateElement,
  cancelElementAnimation,
  DEFAULT_ANIMATION_DURATION,
  getEnterAnimation,
  getExitAnimationParams,
  getHideMotion,
  getModalAnimationDuration,
  getShowMotion,
  isSheetViewport,
  ModalMotion,
  setStyle,
} from "./motion";
import { createSheetDrag } from "./sheet-drag";

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
  onEscape?: (e: Event) => void;
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

export function AnimatedModal(props: AnimatedModalProps): JSXElement {
  onMount(() => onCleanup(registerModalHost(props.id)));
  // Refs are assigned by SolidJS via the ref attribute
  const [dialogRef, dialogEl] = useRef<HTMLDialogElement>();
  const [modalRef, modalEl] = useRef<HTMLDivElement>();
  let returnFocus: HTMLElement | undefined;
  let motionId = 0;
  let disposed = false;
  onMount(() => {
    const unregister = registerOverlayVisibility(
      () => (dialogEl()?.getClientRects().length ?? 0) > 0,
    );
    onCleanup(unregister);
  });

  const visibility = (): boolean => isModalOpen(props.id);

  const usesSheetAnimation = (): boolean =>
    props.mobileSheet !== false && isSheetViewport();

  const sheetDrag = createSheetDrag({
    modal: modalEl,
    canDrag: () => usesSheetAnimation() && props.closeOnWrapperClick !== false,
    isOpen: visibility,
    dismiss: (e) => {
      if (props.onBackdropClick) {
        props.onBackdropClick(e);
      } else {
        storeHideModal(props.id);
      }
    },
  });

  // Handle open/close with animations
  createEffectOn(
    visibility,
    (visible) => {
      const isChained = isModalChained(props.id);

      if (visible) {
        void showModal(isChained);
      } else if (dialogEl()?.open) {
        void hideModal(isChained);
      } else if (!visible) {
        completeModalHide(props.id);
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

    const token = ++motionId;
    try {
      await props.beforeShow?.(isChained);
    } catch (error) {
      console.error("Modal preparation failed", error);
      if (!disposed && token === motionId) {
        storeHideModal(props.id);
        completeModalHide(props.id);
      }
      return;
    }
    if (disposed || token !== motionId) return;

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
    const motion = getShowMotion(sheet);
    const modalAnimDuration = getModalAnimationDuration(
      props.customAnimations?.show?.modal?.duration,
      sheet,
      isChained,
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
          easing: "ease-out",
        });
      }

      // Modal animation
      if (animMode !== "none") {
        const { initialStyle, animParams } = getEnterAnimation(
          motion,
          props.customAnimations?.show?.modal,
        );
        setStyle(modalEl(), initialStyle);

        animateElement(modalEl(), {
          ...animParams,
          duration: modalAnimDuration,
          easing: "ease-out",
          onComplete: () => {
            focusFirstInput();
            void handleAfterShow();
          },
        });
      } else {
        setStyle(modalEl(), {
          opacity: "1",
          transform: "",
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

    const token = ++motionId;
    try {
      await props.beforeHide?.();
    } catch (error) {
      console.error("Modal dismissal failed", error);
    }
    if (disposed || token !== motionId) return;

    const sheet = usesSheetAnimation();
    const dragOffset = sheetDrag.release();
    const motion: ModalMotion = getHideMotion(sheet, dragOffset);
    const modalAnimDuration = getModalAnimationDuration(
      props.customAnimations?.hide?.modal?.duration,
      sheet,
      isChained,
    );

    const animMode = isChained ? "modalOnly" : (props.animationMode ?? "both");

    if (animMode === "both" || animMode === "none") {
      const wrapperDuration = applyReducedMotion(
        props.customAnimations?.hide?.wrapper?.duration ??
          DEFAULT_ANIMATION_DURATION,
      );

      // Modal animation
      if (animMode !== "none") {
        const hideAnimParams = getExitAnimationParams(
          motion,
          props.customAnimations?.hide?.modal,
        );
        animateElement(modalEl(), {
          ...hideAnimParams,
          duration: modalAnimDuration,
        });

        animateElement(dialogEl(), {
          opacity: [1, 0],
          duration: wrapperDuration,
          onComplete: async () => {
            await closeDialog(isChained, token);
          },
        });
      } else {
        await closeDialog(isChained, token);
      }
    } else if (animMode === "modalOnly") {
      animateElement(modalEl(), {
        ...motion.exit,
        duration: modalAnimDuration,
        onComplete: async () => {
          await closeDialog(isChained, token);
        },
      });
    }
  };

  const handleAfterHide = async (): Promise<void> => {
    try {
      await props.afterHide?.();
    } finally {
      if (!disposed) completeModalHide(props.id);
    }
  };

  const closeDialog = async (
    isChained: boolean,
    token: number,
  ): Promise<void> => {
    if (disposed || token !== motionId) return;
    dialogEl()?.close();
    await handleAfterHide();
    restoreModalFocus(returnFocus, isChained);
  };

  const handleAfterShow = async (): Promise<void> => {
    await props.afterShow?.();
  };

  const focusFirstInput = (): void => {
    if (modalEl() === undefined || dialogEl() === undefined) return;
    if (!visibility() || !dialogEl()?.open) return;
    focusModalContent(modalEl(), props.focusFirstInput);
  };

  const handleKeyDown = (e: KeyboardEvent): void => {
    if (
      e.key === "Tab" &&
      !e.defaultPrevented &&
      visibility() &&
      props.mode !== "dialog"
    ) {
      trapModalTabFocus(e, modalEl());
    }
    if (e.key === "Escape" && visibility()) {
      e.preventDefault();
      if (props.closeOnEscape === false) return;
      e.stopPropagation();
      if (props.onEscape) {
        props.onEscape(e);
      } else {
        storeHideModal(props.id);
      }
    }
  };

  const handleCancel = (e: Event): void => {
    e.preventDefault();
    if (!visibility() || props.closeOnEscape === false) return;
    if (props.onEscape) {
      props.onEscape(e);
    } else {
      storeHideModal(props.id);
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
    disposed = true;
    motionId++;
    cancelElementAnimation(dialogEl());
    cancelElementAnimation(modalEl());
    completeModalHide(props.id);
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
      onCancel={handleCancel}
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
              onPointerDown={sheetDrag.onPointerDown}
              onPointerMove={sheetDrag.onPointerMove}
              onPointerUp={sheetDrag.onPointerUp}
              onPointerCancel={sheetDrag.onPointerCancel}
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
