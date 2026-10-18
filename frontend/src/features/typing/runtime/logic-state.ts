import { createAppOwned } from "../../../app/application";
import { appObject } from "../../../app/state";
type TestLogicState = {
  lastInitError: Error | null;
  showedLazyModeNotification: boolean;
  testReinitCount: number;
};

const state = createAppOwned<TestLogicState>(() => ({
  lastInitError: null,
  showedLazyModeNotification: false,
  testReinitCount: 0,
}));
export const testLogicState = appObject(state);
