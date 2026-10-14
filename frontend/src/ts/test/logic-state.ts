type TestLogicState = {
  failReason: string;
  lastInitError: Error | null;
  showedLazyModeNotification: boolean;
  testReinitCount: number;
};

export const testLogicState: TestLogicState = {
  failReason: "",
  lastInitError: null,
  showedLazyModeNotification: false,
  testReinitCount: 0,
};
