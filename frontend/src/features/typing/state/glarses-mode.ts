import { createAppSignal } from "#app/state.ts";

const [getGlarsesMode, setGlarsesMode] = createAppSignal(false);

export function get(): boolean {
  return getGlarsesMode();
}

export function enable(): void {
  setGlarsesMode(true);
  console.log(
    "Glarses Mode On - test result will be hidden. You can check the stats in the console (here)",
  );
  console.log("To disable Glarses Mode refresh the page.");
}
