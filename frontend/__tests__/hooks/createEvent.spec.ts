import { createRoot } from "solid-js";
import { describe, expect, it, vi } from "vite-plus/test";
import { createEvent } from "../../src/ts/hooks/createEvent";

describe("createEvent", () => {
  it("allows omitted payloads for optional event values", () => {
    const event = createEvent<boolean | undefined>();
    const listener = vi.fn();
    event.subscribe(listener);
    event.dispatch();
    event.dispatch(true);
    expect(listener.mock.calls).toEqual([[undefined], [true]]);
  });
  it("delivers discriminated payloads unchanged", () => {
    const event = createEvent<
      { type: "number"; value: number } | { type: "text"; value: string }
    >();
    const listener = vi.fn();
    event.subscribe(listener);
    event.dispatch({ type: "number", value: 2 });
    event.dispatch({ type: "text", value: "two" });
    expect(listener.mock.calls).toEqual([
      [{ type: "number", value: 2 }],
      [{ type: "text", value: "two" }],
    ]);
  });
  it("removes stale module subscriptions on hot disposal", () => {
    const event = createEvent<string>();
    const dispose = vi.fn<(callback: () => void) => void>();
    const oldListener = vi.fn();
    event.subscribe(oldListener, { dispose });
    event.dispatch("before");
    dispose.mock.calls[0]?.[0]();
    const newListener = vi.fn();
    event.subscribe(newListener);
    event.dispatch("after");
    expect(oldListener).toHaveBeenCalledExactlyOnceWith("before");
    expect(newListener).toHaveBeenCalledExactlyOnceWith("after");
  });

  it("dispatch notifies subscribers", () => {
    const event = createEvent<string>();
    const fn = vi.fn();
    event.subscribe(fn);
    event.dispatch("hello");
    expect(fn).toHaveBeenCalledWith("hello");
  });

  it("dispatch notifies multiple subscribers", () => {
    const event = createEvent<number>();
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    event.subscribe(fn1);
    event.subscribe(fn2);
    event.dispatch(42);
    expect(fn1).toHaveBeenCalledWith(42);
    expect(fn2).toHaveBeenCalledWith(42);
  });

  it("dispatch with no type arg requires no arguments", () => {
    const event = createEvent();
    const fn = vi.fn();
    event.subscribe(fn);
    event.dispatch();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("subscribe returns an unsubscribe function", () => {
    const event = createEvent<string>();
    const fn = vi.fn();
    const unsub = event.subscribe(fn);
    event.dispatch("a");
    unsub();
    event.dispatch("b");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("a");
  });

  it("two independent events do not share state", () => {
    const eventA = createEvent<string>();
    const eventB = createEvent<string>();
    const fnA = vi.fn();
    const fnB = vi.fn();
    eventA.subscribe(fnA);
    eventB.subscribe(fnB);
    eventA.dispatch("a");
    expect(fnA).toHaveBeenCalledWith("a");
    expect(fnB).not.toHaveBeenCalled();
  });

  it("useListener auto-unsubscribes on dispose", () => {
    const event = createEvent<string>();
    const fn = vi.fn();
    createRoot((dispose) => {
      event.useListener(fn);
      event.dispatch("inside");
      dispose();
    });
    event.dispatch("outside");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("inside");
  });

  it("subscriber errors do not prevent other subscribers from running", () => {
    const event = createEvent<string>();
    const fn1 = vi.fn(() => {
      throw new Error("oops");
    });
    const fn2 = vi.fn();
    event.subscribe(fn1);
    event.subscribe(fn2);
    event.dispatch("test");
    expect(fn1).toHaveBeenCalled();
    expect(fn2).toHaveBeenCalled();
  });
});
