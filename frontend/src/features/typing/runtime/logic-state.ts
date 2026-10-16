type TestLogicState = {
  lastInitError: Error | null;
  showedLazyModeNotification: boolean;
  testReinitCount: number;
};

export const testLogicState: TestLogicState = {
  lastInitError: null,
  showedLazyModeNotification: false,
  testReinitCount: 0,
};
