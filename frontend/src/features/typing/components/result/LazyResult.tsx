import {
  createEffect,
  createSignal,
  JSXElement,
  lazy,
  onCleanup,
  Show,
  Suspense,
} from "solid-js";
import { envConfig } from "virtual:env-config";

import { showErrorNotification } from "../../../../ts/states/notifications";
import {
  bindResultScreenLoader,
  waitForResultScreen,
} from "../../../../ts/states/result";
import { isTestActive } from "../../../../ts/states/test";
import { captureTypingRoute } from "../../scope";

const Result = lazy(async () =>
  import("./Result").then((m) => ({ default: m.Result })),
);

export function LazyResult(): JSXElement {
  const [requested, setRequested] = createSignal(false);
  const prepare = async (): Promise<void> => {
    const lease = captureTypingRoute();
    await Result.preload();
    if (!lease.isCurrent()) return;
    setRequested(true);
    await waitForResultScreen();
  };
  onCleanup(bindResultScreenLoader(prepare));
  createEffect(() => {
    if (isTestActive() && (!envConfig.isDevelopment || envConfig.devPrefetch)) {
      void prepare().catch((error: unknown) =>
        showErrorNotification("Could not load result screen", { error }),
      );
    }
  });
  return (
    <Show when={requested()}>
      <Suspense>
        <Result />
      </Suspense>
    </Show>
  );
}
