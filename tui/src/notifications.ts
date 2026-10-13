import {
  createContext,
  createSignal,
  useContext,
  type Accessor,
} from "solid-js";

type NotificationLevel = "success" | "notice" | "error";
type Notification = {
  id: number;
  message: string;
  level: NotificationLevel;
};
export type Notifications = {
  /** Newest last. */
  entries: Accessor<readonly Notification[]>;
  notify: (message: string, level?: NotificationLevel) => void;
  dismiss: (id?: number) => void;
  clear: () => void;
  dispose: () => void;
};

/** Short-lived messages like the web's notification bubbles. */
export function createNotifications(
  options: { durationMs?: number; limit?: number } = {},
): Notifications {
  const [entries, setEntries] = createSignal<readonly Notification[]>([]);
  const timers = new Map<number, ReturnType<typeof setTimeout>>();
  let next = 0;
  function dismiss(id?: number): void {
    const target = id ?? entries().at(-1)?.id;
    if (target === undefined) return;
    clearTimeout(timers.get(target));
    timers.delete(target);
    setEntries((current) => current.filter((entry) => entry.id !== target));
  }
  return {
    entries,
    notify: (message, level = "notice") => {
      const id = ++next;
      setEntries((current) => [
        ...current
          .filter((entry) => entry.message !== message)
          .slice(-((options.limit ?? 3) - 1)),
        { id, message, level },
      ]);
      timers.set(
        id,
        setTimeout(
          () => dismiss(id),
          options.durationMs ?? (level === "error" ? 8000 : 4000),
        ),
      );
    },
    dismiss,
    clear: () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      setEntries([]);
    },
    dispose: () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    },
  };
}

export const NotificationsContext = createContext<Notifications>();
export function useNotifications(): Notifications {
  const notifications = useContext(NotificationsContext);
  if (notifications === undefined) {
    throw new Error("useNotifications outside NotificationsContext");
  }
  return notifications;
}
