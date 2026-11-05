export type LifecycleToken = {
  mountId: number;
  testId: number;
  operationId: number;
};

export type PreparationPhase =
  | "preparing.exiting"
  | "preparing.loading"
  | "preparing.entering";
export type CompletionPhase =
  | "completing.stopping"
  | "completing.loading"
  | "completing.building"
  | "completing.presenting"
  | "completing.revealing";
export type LifecyclePhase =
  | "unmounted"
  | "waitingPreferences"
  | PreparationPhase
  | "ready"
  | "running"
  | CompletionPhase
  | "result"
  | "error.preparation"
  | "error.completion"
  | "error.fatal"
  | "disposed";

export type LifecycleState = LifecycleToken &
  (
    | { phase: "preparing.exiting"; source: "testPage" | "resultPage" }
    | { phase: "completing.loading"; faded: boolean }
    | {
        phase: "error.preparation" | "error.completion" | "error.fatal";
        error: unknown;
        failedPhase: LifecyclePhase;
      }
    | {
        phase: Exclude<
          LifecyclePhase,
          | "preparing.exiting"
          | "completing.loading"
          | "error.preparation"
          | "error.completion"
          | "error.fatal"
        >;
      }
  );

export type LifecycleEvent =
  | {
      type:
        | "MOUNT"
        | "RESTART"
        | "EXIT_DONE"
        | "PREPARED"
        | "ENTER_DONE"
        | "START"
        | "FINISH"
        | "STOPPED"
        | "WORDS_HIDDEN"
        | "COMPLETION_LOADED"
        | "RESULT_BUILT"
        | "RESULT_READY"
        | "PRESENTED"
        | "RETRY"
        | "UNMOUNT"
        | "DISPOSE";
      token?: LifecycleToken;
    }
  | {
      type: "FAIL" | "FATAL";
      error: unknown;
      token?: LifecycleToken;
    };

export function initialLifecycle(): LifecycleState {
  return { phase: "unmounted", mountId: 0, testId: 0, operationId: 0 };
}

export function matchesToken(a: LifecycleToken, b: LifecycleToken): boolean {
  return (
    a.mountId === b.mountId &&
    a.testId === b.testId &&
    a.operationId === b.operationId
  );
}

/** Invalid and stale events are no-ops. Policy guards run before RESTART. */
export function transitionLifecycle(
  state: LifecycleState,
  event: LifecycleEvent,
): LifecycleState {
  if (
    state.phase === "disposed" ||
    (event.token !== undefined && !matchesToken(state, event.token))
  ) {
    return state;
  }
  const token: LifecycleToken = {
    mountId: state.mountId,
    testId: state.testId,
    operationId: state.operationId,
  };
  const next = (phase: LifecycleState["phase"]): LifecycleState =>
    ({ ...token, phase }) as LifecycleState;
  if (event.type === "DISPOSE") {
    return { ...token, operationId: token.operationId + 1, phase: "disposed" };
  }
  if (event.type === "UNMOUNT") {
    return { ...token, operationId: token.operationId + 1, phase: "unmounted" };
  }
  if (event.type === "MOUNT") {
    return state.phase === "unmounted"
      ? {
          ...token,
          mountId: token.mountId + 1,
          operationId: token.operationId + 1,
          phase: "waitingPreferences",
        }
      : state;
  }
  if (event.type === "FATAL" || event.type === "FAIL") {
    if (state.phase === "unmounted" || state.phase.startsWith("error.")) {
      return state;
    }
    return {
      ...token,
      operationId: token.operationId + 1,
      phase:
        event.type === "FATAL"
          ? "error.fatal"
          : state.phase.startsWith("completing.")
            ? "error.completion"
            : "error.preparation",
      error: event.error,
      failedPhase: state.phase,
    };
  }
  if (event.type === "RETRY" && state.phase === "error.completion") {
    const phase = state.failedPhase as CompletionPhase;
    return phase === "completing.loading"
      ? { ...token, operationId: token.operationId + 1, phase, faded: false }
      : { ...token, operationId: token.operationId + 1, phase };
  }
  if (event.type === "RESTART") {
    if (
      ![
        "waitingPreferences",
        "ready",
        "running",
        "result",
        "error.preparation",
        "error.completion",
      ].includes(state.phase)
    ) {
      return state;
    }
    return {
      ...token,
      testId: token.testId + 1,
      operationId: token.operationId + 1,
      phase: "preparing.exiting",
      source: state.phase === "result" ? "resultPage" : "testPage",
    };
  }
  if (event.type === "WORDS_HIDDEN" && state.phase === "completing.loading") {
    return { ...state, faded: true };
  }
  const transitions: Partial<
    Record<LifecyclePhase, [LifecycleEvent["type"], LifecyclePhase]>
  > = {
    "preparing.exiting": ["EXIT_DONE", "preparing.loading"],
    "preparing.loading": ["PREPARED", "preparing.entering"],
    "preparing.entering": ["ENTER_DONE", "ready"],
    ready: ["START", "running"],
    running: ["FINISH", "completing.stopping"],
    "completing.stopping": ["STOPPED", "completing.loading"],
    "completing.loading": ["COMPLETION_LOADED", "completing.building"],
    "completing.building": ["RESULT_BUILT", "completing.presenting"],
    "completing.presenting": ["RESULT_READY", "completing.revealing"],
    "completing.revealing": ["PRESENTED", "result"],
  };
  const step = transitions[state.phase];
  if (step?.[0] !== event.type) return state;
  if (step[1] === "completing.loading") {
    return { ...token, phase: step[1], faded: false };
  }
  return next(step[1]);
}

export const isPreparing = (state: LifecycleState): boolean =>
  state.phase.startsWith("preparing.");
export const isCompleting = (state: LifecycleState): boolean =>
  state.phase.startsWith("completing.");
export function resultVisible(state: LifecycleState): boolean {
  return (
    (state.phase === "preparing.exiting" && state.source === "resultPage") ||
    [
      "completing.building",
      "completing.presenting",
      "completing.revealing",
      "result",
    ].includes(state.phase)
  );
}
export function resultLoading(state: LifecycleState): boolean {
  return (
    (state.phase === "completing.loading" && state.faded) ||
    state.phase === "completing.building" ||
    state.phase === "completing.presenting"
  );
}
