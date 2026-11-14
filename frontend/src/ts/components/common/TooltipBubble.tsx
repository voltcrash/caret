import {
  autoUpdate,
  computePosition,
  flip,
  hide,
  offset,
  shift,
  type Placement,
} from "@floating-ui/dom";
import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";
import { isServer, Portal } from "solid-js/web";

import type { BalloonPosition } from "./Balloon";

import { createAppOwned } from "../../../app/application";
import { cn } from "../../utils/cn";

const placements: Record<BalloonPosition, Placement> = {
  up: "top",
  down: "bottom",
  left: "left",
  right: "right",
  "up-left": "top-start",
  "up-right": "top-end",
};

const activeTooltip = createAppOwned(() => createSignal<symbol>());

/** Only the open tooltip allocates a popover and positioning observers. */
export function TooltipBubble(props: {
  reference: HTMLElement | undefined;
  text: string;
  position: BalloonPosition;
  length: string | undefined;
  breaks: boolean;
}) {
  // oxlint-disable-next-line solid/components-return-once -- isServer is a build-time constant; SSR has no browser application owner.
  if (isServer) return null;
  const token = Symbol("tooltip");
  // Capture this app's signal; cleanup must never write into a later app mount.
  const [active, setActive] = activeTooltip();
  const open = () => active() === token;
  const setOpen = (value: boolean): void => {
    setActive((current) =>
      value ? token : current === token ? undefined : current,
    );
  };
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  let focused = false;
  const cancelClose = (): void => clearTimeout(closeTimer);
  const close = (): void => {
    cancelClose();
    setOpen(false);
  };
  onCleanup(close);
  const scheduleClose = (): void => {
    cancelClose();
    if (!focused) closeTimer = setTimeout(close, 150);
  };

  createEffect(() => {
    const trigger = props.reference;
    if (!trigger) return;
    const enter = (event: PointerEvent): void => {
      if (event.pointerType === "touch" || trigger.closest(".noBalloons")) {
        return;
      }
      cancelClose();
      setOpen(true);
    };
    const focus = (): void => {
      if (
        !trigger.matches(":focus-visible") ||
        trigger.closest(".noBalloons")
      ) {
        return;
      }
      focused = true;
      setOpen(true);
    };
    const blur = (): void => {
      focused = false;
      close();
    };
    trigger.addEventListener("pointerenter", enter);
    trigger.addEventListener("pointerleave", scheduleClose);
    trigger.addEventListener("focus", focus);
    trigger.addEventListener("blur", blur);
    trigger.addEventListener("pointerdown", close);
    onCleanup(() => {
      trigger.removeEventListener("pointerenter", enter);
      trigger.removeEventListener("pointerleave", scheduleClose);
      trigger.removeEventListener("focus", focus);
      trigger.removeEventListener("blur", blur);
      trigger.removeEventListener("pointerdown", close);
      cancelClose();
    });
  });

  createEffect(() => {
    if (!open()) return;
    const escape = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    // Dismiss the hint before a containing dialog or global hotkey sees Escape.
    window.addEventListener("keydown", escape, true);
    onCleanup(() => window.removeEventListener("keydown", escape, true));
  });

  return (
    <Show when={open() && props.reference}>
      {(reference) => (
        <Portal mount={reference().closest("dialog") ?? document.body}>
          <Bubble
            {...props}
            reference={reference()}
            onEnter={cancelClose}
            onLeave={scheduleClose}
            onClose={close}
          />
        </Portal>
      )}
    </Show>
  );
}

function Bubble(props: {
  reference: HTMLElement;
  text: string;
  position: BalloonPosition;
  length: string | undefined;
  breaks: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onClose: () => void;
}) {
  let element!: HTMLDivElement;
  const [coordinates, setCoordinates] = createSignal({
    x: 0,
    y: 0,
    ready: false,
  });
  onMount(() => {
    // A manual popover escapes clipping, including scrollable native dialogs.
    element.showPopover();
    onCleanup(() => element.hidePopover());
  });
  createEffect(() => {
    const reference = props.reference;
    const placement = placements[props.position];
    let disposed = false;
    let revision = 0;
    const update = async (): Promise<void> => {
      const current = ++revision;
      if (
        !reference.isConnected ||
        !reference.checkVisibility() ||
        reference.closest(".noBalloons")
      ) {
        props.onClose();
        return;
      }
      const { x, y, middlewareData } = await computePosition(
        reference,
        element,
        {
          strategy: "fixed",
          placement,
          middleware: [
            offset(8),
            flip({ padding: 8 }),
            shift({ padding: 8, crossAxis: true }),
            hide(),
          ],
        },
      );
      if (disposed || current !== revision) return;
      if (middlewareData.hide?.referenceHidden) props.onClose();
      else setCoordinates({ x, y, ready: true });
    };
    const stop = autoUpdate(reference, element, () => void update());
    onCleanup(() => {
      disposed = true;
      stop();
    });
  });
  return (
    <div
      ref={(el) => {
        element = el;
      }}
      popover="manual"
      role="tooltip"
      class={cn(
        "fixed inset-auto z-1000 m-0 w-max max-w-[min(30rem,calc(100dvw-1rem))] max-h-[calc(100dvh-1rem)] overflow-auto rounded-half border border-sub bg-sub-alt px-3 py-2 text-base leading-snug font-(family-name:--font) text-text shadow-lg [overflow-wrap:anywhere]",
        props.breaks ? "whitespace-pre-wrap" : "whitespace-normal",
        props.length === "small" && "w-20",
        props.length === "medium" && "w-[10rem]",
        props.length === "large" && "w-[16.25rem]",
        props.length === "xlarge" && "w-[23.75rem]",
      )}
      style={{
        left: `${coordinates().x}px`,
        top: `${coordinates().y}px`,
        visibility: coordinates().ready ? "visible" : "hidden",
      }}
      onPointerEnter={() => props.onEnter()}
      onPointerLeave={() => props.onLeave()}
    >
      {props.text}
    </div>
  );
}
