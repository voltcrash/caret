import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { onDOMReady, __testing } from "../../src/ts/utils/dom-ready";
const resetReady = __testing.resetReady;

describe("dom ready", () => {
  describe("onDOMReady", () => {
    beforeEach(() => {
      document.body.innerHTML = "";
      resetReady();
      vi.useFakeTimers();
    });

    function dispatchEvent(event: "DOMContextLoaded" | "load"): void {
      if (event === "DOMContextLoaded") {
        document.dispatchEvent(new Event("DOMContentLoaded"));
      } else {
        window.dispatchEvent(new Event("load"));
      }

      vi.runAllTimers();
    }

    it("executes callbacks when DOMContentLoaded fires", () => {
      const spy = vi.fn();
      onDOMReady(spy);
      expect(spy).not.toHaveBeenCalled();

      dispatchEvent("DOMContextLoaded");

      expect(spy).toHaveBeenCalledOnce();
    });

    it("executes callbacks added before ready in order", () => {
      const calls: number[] = [];
      onDOMReady(() => calls.push(1));
      onDOMReady(() => calls.push(2));

      dispatchEvent("DOMContextLoaded");

      expect(calls).toEqual([1, 2]);
    });

    it("executes callbacks asynchronously when DOM is already ready", () => {
      const spy = vi.fn();

      Object.defineProperty(document, "readyState", {
        value: "complete",
        configurable: true,
      });

      onDOMReady(spy);

      expect(spy).not.toHaveBeenCalled();

      vi.runAllTimers();

      expect(spy).toHaveBeenCalledOnce();
    });

    it("executes callbacks added after ready asynchronously", () => {
      const calls: string[] = [];
      onDOMReady(() => calls.push("ready"));

      dispatchEvent("DOMContextLoaded");

      onDOMReady(() => calls.push("late"));

      expect(calls).toEqual(["ready"]);

      vi.runAllTimers();

      expect(calls).toEqual(["ready", "late"]);
    });

    it("executes callbacks added during ready execution", () => {
      const calls: number[] = [];

      onDOMReady(() => {
        calls.push(1);
        onDOMReady(() => calls.push(3));
      });

      onDOMReady(() => calls.push(2));

      dispatchEvent("DOMContextLoaded");

      expect(calls).toEqual([1, 2, 3]);
    });

    it("does not execute ready callbacks more than once", () => {
      const spy = vi.fn();

      onDOMReady(spy);

      dispatchEvent("DOMContextLoaded");
      dispatchEvent("load");

      expect(spy).toHaveBeenCalledOnce();
    });

    it("falls back to window load event if DOMContentLoaded does not fire", () => {
      const spy = vi.fn();

      onDOMReady(spy);

      dispatchEvent("load");

      expect(spy).toHaveBeenCalledOnce();
    });
  });
});
