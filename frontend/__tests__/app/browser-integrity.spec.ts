import { describe, expect, it } from "vite-plus/test";

import { lockMath } from "../../src/app/browser-integrity";

function createScope(): { Math: Math } {
  // A detached Math-like object keeps the test realm's intrinsics mutable.
  return { Math: { random: () => 0.5 } as unknown as Math };
}

describe("lockMath", () => {
  it("freezes Math.random and the window binding", () => {
    const scope = createScope();
    const math = scope.Math;
    lockMath(scope);
    expect(Object.isFrozen(math)).toBe(true);
    expect(() => {
      (math as { random: () => number }).random = () => 1;
    }).toThrow(TypeError);
    expect(() => {
      scope.Math = {} as Math;
    }).toThrow(TypeError);
    expect(scope.Math).toBe(math);
  });

  it("is idempotent across remounts", () => {
    const scope = createScope();
    lockMath(scope);
    expect(() => lockMath(scope)).not.toThrow();
  });
});
