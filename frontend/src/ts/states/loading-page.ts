import { createAppSignal } from "../../app/state";
import { batch } from "solid-js";

type LoadingPageMode = "spinner" | "error" | "bar";

type BarAnimation = {
  percentage: number;
  duration: number;
  onComplete: () => void;
};

const [getMode, setMode] = createAppSignal<LoadingPageMode>("spinner");
const [getText, setText] = createAppSignal("Loading...");
const [isTextVisible, setTextVisible] = createAppSignal(false);
const [getBarAnimation, setBarAnimation] = createAppSignal<BarAnimation>();

export { getMode, getText, isTextVisible, getBarAnimation };

export async function updateBar(
  percentage: number,
  duration: number,
): Promise<void> {
  // Replacing an animation must release the previous keyframe's waiter.
  getBarAnimation()?.onComplete();
  return new Promise((resolve) => {
    setBarAnimation({
      percentage: Math.min(100, Math.max(0, percentage)),
      duration: Math.max(0, duration),
      onComplete: resolve,
    });
  });
}

function clearBar(): void {
  getBarAnimation()?.onComplete();
  setBarAnimation(undefined);
}

export function updateText(text: string): void {
  setTextVisible(true);
  setText(text);
}

export function showSpinner(): void {
  batch(() => {
    clearBar();
    setMode("spinner");
    setTextVisible(false);
  });
}

export function showError(): void {
  batch(() => {
    clearBar();
    setMode("error");
    setTextVisible(false);
  });
}

export async function showBar(): Promise<void> {
  batch(() => {
    if (getMode() !== "bar") clearBar();
    setMode("bar");
    setTextVisible(false);
  });
}
