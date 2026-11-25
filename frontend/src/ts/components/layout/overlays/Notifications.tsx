import {
  Accessor,
  createEffect,
  createSignal,
  For,
  JSXElement,
  on,
  onCleanup,
  onMount,
  Setter,
  untrack,
} from "solid-js";

import { getIsScreenshotting } from "../../../states/core";
import {
  Notification,
  getNotifications,
  removeNotification,
  clearAllNotifications,
} from "../../../states/notifications";
import { getFocus } from "../../../states/test";
import { cn } from "../../../utils/cn";
import { applyReducedMotion } from "../../../utils/misc";
import { Fa, FaProps } from "../../common/Fa";
import { FadeShow } from "../../common/FadeShow";
import { TextContent } from "../../common/TextContent";

const levelConfig = {
  notice: {
    icon: "fa-info-circle",
    title: "Notice",
    border: "var(--notif-notice-border, rgba(0,130,251,0.985))",
    bg: "var(--notif-notice-bg, rgba(0,77,148,0.9))",
    bgHover: "var(--notif-notice-bg-hover, rgba(0,77,148,0.5))",
  },
  success: {
    icon: "fa-check-circle",
    title: "Success",
    border: "var(--notif-success-border, rgba(100,206,100,0.71))",
    bg: "var(--notif-success-bg, rgba(0,148,0,0.9))",
    bgHover: "var(--notif-success-bg-hover, rgba(0,148,0,0.5))",
  },
  error: {
    icon: "fa-times-circle",
    title: "Error",
    border: "var(--notif-error-border, rgba(241,51,34,0.71))",
    bg: "var(--notif-error-bg, rgba(138,18,12,0.9))",
    bgHover: "var(--notif-error-bg-hover, rgba(138,18,12,0.5))",
  },
} as const;

type NotificationEntry = {
  notification: Notification;
  exiting: Accessor<boolean>;
  setExiting: Setter<boolean>;
};

function NotificationItem(props: {
  entry: NotificationEntry;
  onExited: (id: number) => void;
}): JSXElement {
  const notification = (): Notification => props.entry.notification;
  const config = (): (typeof levelConfig)[keyof typeof levelConfig] =>
    levelConfig[notification().level] ?? levelConfig.notice;

  const iconProps = (): FaProps =>
    notification().customIcon !== undefined
      ? ({
          icon: `fa-${notification().customIcon}`,
          fixedWidth: true,
        } as FaProps)
      : { icon: config().icon };

  const title = (): string => notification().customTitle ?? config().title;

  let shellEl: HTMLDivElement | undefined;
  let cardEl: HTMLDivElement | undefined;
  let activeAnim: Animation | undefined;

  onMount(() => {
    const duration = applyReducedMotion(125);
    if (!cardEl || duration <= 0) return;
    activeAnim = cardEl.animate(
      { opacity: ["0", "1"] },
      { duration, easing: "ease-out" },
    );
  });

  createEffect(
    on(
      () => props.entry.exiting(),
      (exiting) => {
        if (!exiting) return;
        const duration = applyReducedMotion(250);
        activeAnim?.cancel();
        activeAnim = undefined;

        if (!shellEl || duration <= 0) {
          props.onExited(notification().id);
          return;
        }

        const currentMargin = getComputedStyle(shellEl).marginBottom || "16px";
        shellEl.style.gridTemplateRows = "0fr";
        shellEl.style.opacity = "0";
        shellEl.style.marginBottom = "0px";
        const current = shellEl.animate(
          {
            gridTemplateRows: ["1fr", "0fr"],
            opacity: ["1", "0"],
            marginBottom: [currentMargin, "0px"],
          },
          { duration, easing: "ease-out" },
        );
        activeAnim = current;
        void current.finished.then(
          () => {
            if (activeAnim !== current) return;
            activeAnim = undefined;
            props.onExited(notification().id);
          },
          () => undefined,
        );
      },
      { defer: true },
    ),
  );

  onCleanup(() => {
    activeAnim?.cancel();
    activeAnim = undefined;
  });

  return (
    <div
      class={cn(
        "transition-opacity duration-125",
        getFocus() && !notification().important && "pointer-events-none hidden",
      )}
    >
      <div ref={(el) => (shellEl = el)} class="mb-4 grid grid-rows-[1fr]">
        <div
          ref={(el) => (cardEl = el)}
          class={cn(
            "pointer-events-auto min-h-0 cursor-pointer overflow-hidden rounded-double border-2 border-solid backdrop-blur-[15px] select-none",
            "relative grid text-[white]",
            "transition-[background] duration-125",
            "border-(--notif-border) bg-(--notif-bg) hover:bg-(--notif-bg-hover)",
            notification().important && "important",
          )}
          style={{
            "--notif-border": config().border,
            "--notif-bg": config().bg,
            "--notif-bg-hover": config().bgHover,
          }}
        >
          <div
            class="p-4 text-sm wrap-anywhere"
            onClick={() => removeNotification(notification().id)}
          >
            <div class="flex items-center gap-2 pb-2 opacity-80">
              <Fa {...iconProps()} class="shrink-0" />
              <span>{title()}</span>
            </div>
            <div>
              <TextContent content={notification().message} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Notifications(): JSXElement {
  const createEntry = (notification: Notification): NotificationEntry => {
    const [exiting, setExiting] = createSignal(false);
    return { notification, exiting, setExiting };
  };

  const [entries, setEntries] = createSignal<NotificationEntry[]>(
    untrack(() => getNotifications().map(createEntry)),
  );

  createEffect(() => {
    const live = getNotifications();
    const liveIds = new Set(live.map((n) => n.id));
    setEntries((prev) => {
      const existingIds = new Set(prev.map((e) => e.notification.id));
      const added = live.filter((n) => !existingIds.has(n.id)).map(createEntry);
      for (const entry of prev) {
        if (!liveIds.has(entry.notification.id) && !entry.exiting()) {
          entry.setExiting(true);
        }
      }
      return added.length > 0 ? [...added, ...prev] : prev;
    });
  });

  const handleExited = (id: number): void => {
    setEntries((prev) => prev.filter((entry) => entry.notification.id !== id));
  };

  const stickyCount = (): number => {
    const focus = getFocus();
    return getNotifications().filter(
      (n) => n.durationMs === 0 && (!focus || n.important),
    ).length;
  };

  return (
    <div
      data-ui-element="notifications"
      inert={getIsScreenshotting()}
      class={cn(
        "pointer-events-none mx-4 grid min-h-0 content-start overflow-y-auto overscroll-contain pt-4 transition-opacity duration-125 sm:fixed sm:top-0 sm:right-4 sm:z-99999999 sm:mx-0 sm:max-h-dvh sm:w-87.5",
        getIsScreenshotting() && "opacity-0",
      )}
    >
      <FadeShow when={stickyCount() > 1}>
        <button
          type="button"
          class="text-white pointer-events-auto mb-4 w-full overflow-hidden text-xs"
          onClick={() => clearAllNotifications()}
        >
          <Fa icon="fa-times" class="mr-1" />
          Clear all
        </button>
      </FadeShow>
      <For each={entries()}>
        {(entry) => <NotificationItem entry={entry} onExited={handleExited} />}
      </For>
    </div>
  );
}
