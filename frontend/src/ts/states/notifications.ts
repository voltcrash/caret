import { onCleanup } from "solid-js";
import { createAppOwned } from "../../app/application";
import { createAppStore } from "../../app/state";

import { CommonResponsesType } from "@oxytype/contracts/util/api";
import { createErrorMessage } from "../utils/error";
import { MessageContent } from "../types/message-content";

export type NotificationLevel = "error" | "notice" | "success";

export type Notification = {
  id: number;
  message: MessageContent;
  level: NotificationLevel;
  important: boolean;
  durationMs: number;
  customTitle?: string;
  customIcon?: string;
  onDismiss?: (reason: "click" | "timeout" | "clear") => void;
};

export type NotificationHistoryEntry = {
  id: string;
  title: string;
  message: MessageContent;
  level: NotificationLevel;
  details?: string | object;
};

let id = 0;
const [notifications, setNotifications] = createAppStore<Notification[]>([]);
const timers = createAppOwned(() => {
  const timers = new Map<number, ReturnType<typeof setTimeout>>();
  onCleanup(() => {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
  });
  return timers;
});

const [notificationHistory, setNotificationHistory] = createAppStore<
  NotificationHistoryEntry[]
>([]);
let historyId = 0;

function addNotificationToStore(
  notification: Omit<Notification, "id">,
): number {
  const newId = id++;
  setNotifications((prev) => [{ ...notification, id: newId }, ...prev]);
  return newId;
}

export function removeNotification(
  notificationId: number,
  reason: "click" | "timeout" | "clear" = "click",
): void {
  const timer = timers().get(notificationId);
  if (timer !== undefined) {
    clearTimeout(timer);
    timers().delete(notificationId);
  }
  let onDismiss: Notification["onDismiss"] | undefined;
  setNotifications((prev) =>
    prev.filter((n) => {
      if (n.id === notificationId) {
        onDismiss = n.onDismiss;
        return false;
      }
      return true;
    }),
  );
  onDismiss?.(reason);
}

export function clearAllNotifications(): void {
  for (const [, timer] of timers()) {
    clearTimeout(timer);
  }
  timers().clear();
  const prev = [...notifications];
  setNotifications([]);
  for (const notification of prev) {
    try {
      notification.onDismiss?.("clear");
    } catch (e) {
      console.error("onDismiss threw during clearAll", e);
    }
  }
}

export const __testing = {
  clearNotificationHistory(): void {
    setNotificationHistory([]);
  },
};

export function getNotifications(): Notification[] {
  return notifications;
}

export function getNotificationHistory(): NotificationHistoryEntry[] {
  return notificationHistory;
}

export type AddNotificationOptions = Partial<
  Pick<
    Notification,
    "important" | "durationMs" | "customTitle" | "customIcon" | "onDismiss"
  >
> & {
  details?: object | string;
  response?: CommonResponsesType;
  error?: unknown;
};

function updateLastLine(
  message: MessageContent,
  update: (line: string) => string,
): MessageContent {
  if (typeof message === "string") return update(message);
  const lines = [...message];
  const last = lines.pop() ?? "";
  return [...lines, update(last)];
}

export function addNotificationWithLevel(
  message: MessageContent,
  level: NotificationLevel,
  options: AddNotificationOptions = {},
): number {
  let details = options.details;

  if (options.response !== undefined) {
    details = {
      status: options.response.status,
      additionalDetails: options.details,
      validationErrors:
        options.response.status === 422
          ? options.response.body.validationErrors
          : undefined,
    };
    const responseMessage = options.response.body.message;
    message = updateLastLine(message, (line) => `${line}: ${responseMessage}`);
  }

  if (options.error !== undefined) {
    message = updateLastLine(message, (line) =>
      createErrorMessage(options.error, line),
    );
  }

  const title =
    options.customTitle ??
    (level === "success" ? "Success" : level === "error" ? "Error" : "Notice");

  setNotificationHistory((prev) => {
    const next = [
      ...prev,
      {
        id: (historyId++).toString(),
        title,
        message,
        level,
        details,
      },
    ];
    return next.length > 25 ? next.slice(-25) : next;
  });

  const durationMs = options.durationMs ?? (level === "error" ? 0 : 3000);

  const notifId = addNotificationToStore({
    message,
    level,
    important: options.important ?? false,
    durationMs,
    customTitle: options.customTitle,
    customIcon: options.customIcon,
    onDismiss: options.onDismiss,
  });

  if (durationMs > 0) {
    // +250 accounts for the exit animation duration in Notifications.tsx
    const timer = setTimeout(() => {
      timers().delete(notifId);
      removeNotification(notifId, "timeout");
    }, durationMs + 250);
    timers().set(notifId, timer);
  }

  return notifId;
}

export function showNoticeNotification(
  message: MessageContent,
  options?: AddNotificationOptions,
): number {
  return addNotificationWithLevel(message, "notice", options);
}

export function showSuccessNotification(
  message: MessageContent,
  options?: AddNotificationOptions,
): number {
  return addNotificationWithLevel(message, "success", options);
}

export function showErrorNotification(
  message: MessageContent,
  options?: AddNotificationOptions,
): number {
  return addNotificationWithLevel(message, "error", options);
}
