import { debounce } from "@oxytype/util/timing";
import { onCleanup, onMount } from "solid-js";

import { Breakpoints, setBreakpoints } from "../../states/breakpoints";

export function BreakpointEvents(): null {
  onMount(() => {
    const styles = getComputedStyle(document.documentElement);
    const sizes = {
      xxs: 0,
      xs: parseInt(styles.getPropertyValue("--breakpoint-xs")),
      sm: parseInt(styles.getPropertyValue("--breakpoint-sm")),
      md: parseInt(styles.getPropertyValue("--breakpoint-md")),
      lg: parseInt(styles.getPropertyValue("--breakpoint-lg")),
      xl: parseInt(styles.getPropertyValue("--breakpoint-xl")),
      xxl: parseInt(styles.getPropertyValue("--breakpoint-2xl")),
    };
    const queries = Object.fromEntries(
      Object.entries(sizes).map(([key, px]) => [
        key,
        window.matchMedia(`(min-width: ${px}px)`),
      ]),
    );
    const update = (): void => {
      setBreakpoints(
        Object.fromEntries(
          Object.entries(queries).map(([key, query]) => [key, query.matches]),
        ) as Breakpoints,
      );
    };
    const debouncedUpdate = debounce(125, update);
    update();
    for (const query of Object.values(queries)) {
      query.addEventListener("change", debouncedUpdate);
    }
    onCleanup(() => {
      debouncedUpdate.cancel();
      for (const query of Object.values(queries)) {
        query.removeEventListener("change", debouncedUpdate);
      }
    });
  });
  return null;
}
