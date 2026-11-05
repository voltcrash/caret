import { createAppSignalWithSetters } from "../hooks/createSignalWithSetters";
import { createAppSignal } from "../../app/state";
import { captureApplication } from "../../app/application";

type LoaderSignal = null | {
  visible: boolean;
  instant?: boolean;
};

const [legacyLoader, { showLoaderBar, hideLoaderBar }] =
  createAppSignalWithSetters<LoaderSignal>(null)({
    showLoaderBar: (set, instant: boolean = false) =>
      set({ visible: true, instant }),
    hideLoaderBar: (set) => set({ visible: false }),
  });
export { showLoaderBar, hideLoaderBar };
const [pending, setPending] = createAppSignal(0);
export const getLoaderBarSignal = (): LoaderSignal =>
  pending() > 0 ? { visible: true } : legacyLoader();
export function beginLoaderBar(): () => void {
  const lease = captureApplication();
  let done = false;
  setPending((count) => count + 1);
  return () => {
    if (done) return;
    done = true;
    if (!lease.signal.aborted) setPending((count) => count - 1);
  };
}
