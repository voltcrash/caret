/**
 * Timing curve shared by a compositor animation (`css`) and the script that
 * needs to know where that animation is drawing (`at`).
 */
export type CaretEasing = {
  readonly css: string;
  /** Eased progress at time fraction `t` (0..1). */
  at(t: number): number;
};

export const linearEasing: CaretEasing = {
  css: "linear",
  at: (t) => clamp01(t),
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/** CSS `cubic-bezier()`, solved the same way browsers solve it. */
export function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): CaretEasing {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (s: number): number => ((ax * s + bx) * s + cx) * s;
  const sampleY = (s: number): number => ((ay * s + by) * s + cy) * s;
  const slopeX = (s: number): number => (3 * ax * s + 2 * bx) * s + cx;

  // Curve parameter whose x is `t`: Newton first, bisection as a fallback.
  const solve = (t: number): number => {
    let s = t;
    for (let i = 0; i < 8; i++) {
      const error = sampleX(s) - t;
      if (Math.abs(error) < 1e-7) return s;
      const derivative = slopeX(s);
      if (Math.abs(derivative) < 1e-7) break;
      s -= error / derivative;
    }
    let low = 0;
    let high = 1;
    s = t;
    for (let i = 0; i < 40 && high - low > 1e-7; i++) {
      if (sampleX(s) < t) low = s;
      else high = s;
      s = (low + high) / 2;
    }
    return s;
  };

  return {
    css: `cubic-bezier(${round(x1)}, ${round(y1)}, ${round(x2)}, ${round(y2)})`,
    at: (t) => {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      return sampleY(solve(t));
    },
  };
}

// Ease-out: the caret leaves at full speed and settles onto the letter, so a
// keystroke moves it on the next frame, and typing mid-glide never slows it
// down before speeding it up again.
export const caretGlideEasing = cubicBezier(0.25, 0.46, 0.45, 0.94);
