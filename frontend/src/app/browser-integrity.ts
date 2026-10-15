import { isServer } from "solid-js/web";

type MathScope = { Math: Math };

/**
 * Anti-tamper for result hashing: freeze `Math` and its window binding.
 * Browser only; never mutates shared Worker intrinsics during SSR.
 */
export function lockMath(scope: MathScope = window): void {
  if (isServer) throw new Error("Math locking is browser-only");
  const math = scope.Math;
  if (Object.isFrozen(math)) return;
  Object.defineProperty(math, "random", {
    value: math.random,
    writable: false,
    configurable: false,
    enumerable: true,
  });
  Object.freeze(math);
  Object.defineProperty(scope, "Math", {
    value: math,
    writable: false,
    configurable: false,
    enumerable: true,
  });
}
