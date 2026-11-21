import { createAppMemo } from "#app/application.ts";
import { IncompleteTest } from "@caret/schemas/results";
import { createAppSignalWithSetters } from "#shared/hooks/createSignalWithSetters.ts";

export const [
  getIncompleteTests,
  { push: pushIncompleteTest, reset: resetIncompleteTests },
] = createAppSignalWithSetters<IncompleteTest[]>([])({
  push: (set, val: IncompleteTest) => set((arr) => [...arr, val]),
  reset: (set) => set([]),
});

export const getRestartCount = createAppMemo(() => getIncompleteTests().length);

export const getIncompleteSeconds = createAppMemo(() =>
  getIncompleteTests().reduce((sum, test) => sum + test.seconds, 0),
);
