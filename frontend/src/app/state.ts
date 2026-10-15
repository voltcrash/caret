import { createSignal, type Signal, type SignalOptions } from "solid-js";
import { createStore, type SetStoreFunction } from "solid-js/store";

import { createAppOwned } from "./application";
import { createAccountOwned } from "./account-scope";

/** Preserve generic/overloaded signatures while resolving a method at call time. */
export function appMethod<T extends (...args: never[]) => unknown>(
  read: () => T,
): T {
  return new Proxy((() => undefined) as unknown as T, {
    apply: (_target, receiver, args) =>
      Reflect.apply(read(), receiver, args) as unknown,
  });
}

/** Stable compatibility accessors; the value itself belongs to the mounted app. */
export function createAppSignal<T>(): Signal<T | undefined>;
export function createAppSignal<T>(
  value: T,
  options?: SignalOptions<T>,
): Signal<T>;
export function createAppSignal<T>(
  value?: T,
  options?: SignalOptions<T>,
): Signal<T | undefined> {
  return appSignal(() =>
    createSignal<T | undefined>(
      copyInitial(value),
      options as SignalOptions<T | undefined>,
    ),
  );
}

export function appSignal<T>(create: () => Signal<T>): Signal<T> {
  return ownedSignal(createAppOwned(create));
}

export function createAccountSignal<T>(value: T): Signal<T> {
  return ownedSignal(
    createAccountOwned(() => createSignal(copyInitial(value))),
  );
}

function ownedSignal<T>(signal: () => Signal<T>): Signal<T> {
  return [
    () => signal()[0](),
    ((...args: unknown[]) =>
      Reflect.apply(signal()[1], undefined, args) as unknown) as Signal<T>[1],
  ];
}

/** Redirect object reads to this app without retaining a previous mount's store. */
export function appObject<T extends object>(read: () => T, array = false): T {
  return new Proxy(array ? [] : {}, {
    get: (_target, key) => Reflect.get(read(), key),
    set: (_target, key, value) => Reflect.set(read(), key, value),
    deleteProperty: (_target, key) => Reflect.deleteProperty(read(), key),
    has: (_target, key) => Reflect.has(read(), key),
    ownKeys: () => Reflect.ownKeys(read()),
    getOwnPropertyDescriptor: (_target, key) =>
      Reflect.getOwnPropertyDescriptor(read(), key),
  }) as T;
}

export function createAppStore<T extends object>(
  initial: T | (() => T),
): [T, SetStoreFunction<T>] {
  return appStore(
    () =>
      createStore(
        typeof initial === "function" ? initial() : copyInitial(initial),
      ),
    Array.isArray(initial),
  );
}

export function appStore<T extends object>(
  create: () => [T, SetStoreFunction<T>],
  array = false,
): [T, SetStoreFunction<T>] {
  return ownedStore(createAppOwned(create), array);
}

export function createAccountStore<T extends object>(
  initial: T,
): [T, SetStoreFunction<T>] {
  return ownedStore(
    createAccountOwned(() => createStore(copyInitial(initial))),
    Array.isArray(initial),
  );
}

function ownedStore<T extends object>(
  store: () => [T, SetStoreFunction<T>],
  array: boolean,
): [T, SetStoreFunction<T>] {
  return [
    appObject(() => store()[0], array),
    (...args: unknown[]) =>
      Reflect.apply(
        store()[1] as (...args: unknown[]) => unknown,
        undefined,
        args,
      ),
  ];
}

// Initial state contains plain data. Preserve non-plain values (e.g. callbacks).
function copyInitial<T>(value: T): T {
  if (value instanceof Set) return new Set(value) as T;
  if (value instanceof Map) return new Map(value) as T;
  if (Array.isArray(value)) return value.map(copyInitial) as T;
  if (
    value !== null &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, copyInitial(item)]),
    ) as T;
  }
  return value;
}
