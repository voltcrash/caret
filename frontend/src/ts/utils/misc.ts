import { lastElementFromArray } from "./arrays";
import { Mode } from "@oxytype/schemas/shared";
import { Result } from "@oxytype/schemas/results";
import { RankAndCount } from "@oxytype/schemas/users";
import { roundTo2 } from "@oxytype/util/numbers";
import { download } from "../components/common/Download";

export function findGetParameter(
  parameterName: string,
  getOverride?: string,
): string | null {
  let result = null;
  let tmp = [];

  let search = location.search;
  if (getOverride !== undefined && getOverride !== "") {
    search = getOverride;
  }

  search
    .slice(1)
    .split("&")
    .forEach(function (item) {
      tmp = item.split("=");
      if (tmp[0] === parameterName) {
        result = decodeURIComponent(tmp[1] as string);
      }
    });
  return result;
}

export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function escapeHTML<T extends string | null | undefined>(str: T): T {
  if (str === null || str === undefined) {
    return str;
  }

  const escapeMap: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
    "/": "&#x2F;",
    "`": "&#x60;",
  };

  return str.replace(/[&<>"'/`]/g, (char) => escapeMap[char] as string) as T;
}

export function clearTimeouts(timeouts: (number | NodeJS.Timeout)[]): void {
  timeouts.forEach((to) => {
    if (typeof to === "number") clearTimeout(to);
    else clearTimeout(to);
  });
}

type LastIndex = {
  lastIndexOfRegex(regex: RegExp): number;
} & string;

(String.prototype as LastIndex).lastIndexOfRegex = function (
  regex: RegExp,
): number {
  const match = this.match(regex);
  return match ? this.lastIndexOf(lastElementFromArray(match) as string) : -1;
};

export { getMode2 } from "@oxytype/typing-core/mode";

export async function downloadResultsCSV(array: Result<Mode>[]): Promise<void> {
  const csvString = [
    [
      "_id",
      "isPb",
      "wpm",
      "acc",
      "rawWpm",
      "consistency",
      "charStats",
      "mode",
      "mode2",
      "quoteLength",
      "restartCount",
      "testDuration",
      "afkDuration",
      "incompleteTestSeconds",
      "punctuation",
      "numbers",
      "language",
      "funbox",
      "difficulty",
      "lazyMode",
      "blindMode",
      "bailedOut",
      "tags",
      "timestamp",
      "client",
      "offline",
    ],
    ...array.map((item) => [
      item._id,
      item.isPb,
      item.wpm,
      item.acc,
      item.rawWpm,
      item.consistency,
      item.charStats.join(";"),
      item.mode,
      item.mode2,
      item.quoteLength,
      item.restartCount,
      item.testDuration,
      item.afkDuration,
      item.incompleteTestSeconds,
      item.punctuation,
      item.numbers,
      item.language,
      item.funbox,
      item.difficulty,
      item.lazyMode,
      item.blindMode,
      item.bailedOut,
      item.tags?.join(";"),
      item.timestamp,
      item.client ?? "web",
      item.offline ?? false,
    ]),
  ]
    .map((e) => e.join(","))
    .join("\n");

  const blob = new Blob([csvString], { type: "text/csv" });
  download({ filename: "results.csv", data: blob });
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function reloadAfter(seconds: number): void {
  setTimeout(() => {
    window.location.reload();
  }, seconds * 1000);
}

export function isObject(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === "object" && !Array.isArray(obj) && obj !== null;
}

function prefersReducedMotion(): boolean {
  return matchMedia?.("(prefers-reduced-motion)")?.matches;
}

/**
 * Reduce the animation time based on the browser preference `prefers-reduced-motion`.
 * @param animationTime
 * @returns `0` if user prefers reduced-motion, else the given animationTime
 */
export function applyReducedMotion(animationTime: number): number {
  return prefersReducedMotion() ? 0 : animationTime;
}

/**
 * Creates a promise with resolvers.
 * This is useful for creating a promise that can be resolved or rejected from outside the promise itself.
 * The returned promise reference stays constant even after reset() - it will always await the current internal promise.
 * Note: Promise chains created via .then()/.catch()/.finally() will always follow the current internal promise state, even if created before reset().
 */
export function promiseWithResolvers<T = void>(): {
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
  promise: Promise<T>;
  reset: () => void;
} {
  let innerResolve!: (value: T) => void;
  let innerReject!: (reason?: unknown) => void;
  let currentPromise = new Promise<T>((res, rej) => {
    innerResolve = res;
    innerReject = rej;
  });

  /**
   * This was fully AI generated to make the reset function work. Black magic, but its unit-tested and works.
   */

  const promiseLike = {
    async then<TResult1 = T, TResult2 = never>(
      onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?:
        | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
        | null,
    ): Promise<TResult1 | TResult2> {
      return currentPromise.then(onfulfilled, onrejected);
    },
    async catch<TResult = never>(
      onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
    ): Promise<T | TResult> {
      return currentPromise.catch(onrejected);
    },
    async finally(onfinally?: (() => void) | null): Promise<T> {
      return currentPromise.finally(onfinally);
    },
    [Symbol.toStringTag]: "Promise" as const,
  };

  const reset = (): void => {
    currentPromise = new Promise<T>((res, rej) => {
      innerResolve = res;
      innerReject = rej;
    });
  };

  // Wrapper functions that always call the current resolver/rejecter
  const resolve = (value: T): void => {
    innerResolve(value);
  };

  const reject = (reason?: unknown): void => {
    innerReject(reason);
  };

  return {
    resolve,
    reject,
    promise: promiseLike,
    reset,
  };
}

/**
 * Wrap a function so only one call runs at a time. While a call is running, new
 * calls will not run and only the latest one will be queued, any prior queued
 * calls are skipped. Once the running call finishes, the queued call runs.
 * @param fn the function to debounce
 * @param options - `rejectSkippedCalls`: if false, promises returned by skipped
 * calls will be resolved to null, otherwise will be rejected (defaults to true).
 * @returns debounced version of the original function. This debounced function
 * returns a promise that resolves to the original return value. Promises of skipped
 * calls will be rejected, (or resolved to null if `options.rejectSkippedCalls` was false).
 */
export function debounceUntilResolved<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult,
  options?: { rejectSkippedCalls?: true },
): (...args: TArgs) => Promise<TResult>;
export function debounceUntilResolved<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult,
  options: { rejectSkippedCalls: false },
): (...args: TArgs) => Promise<TResult | null>;
export function debounceUntilResolved<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult,
  { rejectSkippedCalls = true }: { rejectSkippedCalls?: boolean } = {},
): (...args: TArgs) => Promise<TResult | null> {
  let isLocked = false;
  let next: {
    args: TArgs;
    resolve: (value: TResult | null) => void;
    reject: (reason?: unknown) => void;
  } | null = null;

  async function run(...args: TArgs): Promise<TResult> {
    isLocked = true;
    try {
      return await Promise.resolve(fn(...args));
    } finally {
      isLocked = false;

      const queued = next;
      next = null;
      if (queued) run(...queued.args).then(queued.resolve, queued.reject);
    }
  }

  return async function debounced(...args: TArgs): Promise<TResult | null> {
    if (isLocked) {
      // drop previously queued call
      if (next) {
        if (rejectSkippedCalls) {
          next.reject(
            new Error("skipped call: call was superseded by a more recent one"),
          );
        } else {
          next.resolve(null);
        }
      }

      // queue the new call
      return new Promise<TResult | null>((resolve, reject) => {
        next = { args, resolve, reject };
      });
    }
    // no running instances, run immediately
    return run(...args);
  };
}

function isPlatform(searchTerm: string | RegExp): boolean {
  const platform = navigator.platform;
  if (typeof searchTerm === "string") {
    return platform.includes(searchTerm);
  } else {
    return searchTerm.test(platform);
  }
}

//function isWindows(): boolean {
//return isPlatform("Win");
//}

//function isLinux(): boolean {
//return isPlatform("Linux");
//}

//function isMac(): boolean {
//return isPlatform("Mac");
//}

export function isMacLike(): boolean {
  return isPlatform(/Mac|iPod|iPhone|iPad/);
}

export function isFirefox(): boolean {
  const userAgent = window.navigator.userAgent.toLowerCase();
  return userAgent.includes("firefox");
}

export function formatTopPercentage(lbRank?: RankAndCount): string {
  if (lbRank === undefined) return "";
  if (lbRank.rank === undefined) return "-";
  if (lbRank.rank === 1) return "GOAT";
  return `Top ${roundTo2((lbRank.rank / lbRank.count) * 100)}%`;
}

export function formatTypingStatsRatio(stats: {
  startedTests?: number;
  completedTests?: number;
}): {
  completedPercentage: string;
  restartRatio: string;
} {
  if (
    stats.completedTests === undefined ||
    stats.startedTests === undefined ||
    stats.startedTests === 0
  ) {
    return { completedPercentage: "", restartRatio: "" };
  }
  return {
    completedPercentage: Math.floor(
      (stats.completedTests / stats.startedTests) * 100,
    ).toString(),
    restartRatio: (
      (stats.startedTests - stats.completedTests) /
      stats.completedTests
    ).toFixed(1),
  };
}

export function addToGlobal(items: Record<string, unknown>): () => void {
  const previous = new Map(
    Object.keys(items).map((name) => [
      name,
      Object.getOwnPropertyDescriptor(window, name),
    ]),
  );
  for (const [name, item] of Object.entries(items)) {
    Object.assign(window, { [name]: item });
  }
  return () => {
    for (const [name, descriptor] of previous) {
      if (descriptor === undefined) Reflect.deleteProperty(window, name);
      else Object.defineProperty(window, name, descriptor);
    }
  };
}

// DO NOT ALTER GLOBAL OBJECTSONSTRUCTOR, IT WILL BREAK RESULT HASHES
