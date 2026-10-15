import { createAppSignal } from "../../app/state";

import { PageName } from "../pages/page";

const [getTransition, setTransition] = createAppSignal(true);

export function set(val: boolean): void {
  setTransition(val);
}

export function get(): boolean {
  return getTransition();
}

type PageView = {
  id: PageName | null;
  phase: "idle" | "prepared" | "in" | "out" | "active";
  revealed?: true;
  animation?: { duration: number; complete: () => void };
};

const [getPageView, setPageView] = createAppSignal<PageView>({
  id: "loading",
  phase: "idle",
});

export function preparePage(id: NonNullable<PageView["id"]>): void {
  setPageView({ id, phase: "prepared" });
}

export function activatePage(id: NonNullable<PageView["id"]>): void {
  setPageView({ id, phase: "active" });
}

export async function transitionPage(
  id: NonNullable<PageView["id"]>,
  visible: boolean,
  duration: number,
  active = true,
): Promise<void> {
  return new Promise((resolve) => {
    const animation = {
      duration,
      complete: (): void => {
        setPageView((view) =>
          view.animation === animation
            ? {
                id: visible ? id : null,
                phase: visible && active ? "active" : "idle",
              }
            : view,
        );
        resolve();
      },
    };
    setPageView({ id, phase: visible ? "in" : "out", animation });
  });
}

export { getPageView };

export function revealPreparedTestPage(): void {
  setPageView((view) =>
    view.id === "test" && view.phase === "prepared"
      ? { ...view, revealed: true }
      : view,
  );
}
