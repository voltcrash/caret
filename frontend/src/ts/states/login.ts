import { createAppSignalWithSetters } from "../hooks/createSignalWithSetters";

export const [
  getLoginPageInputsEnabled,
  { enableLoginPageInputs, disableLoginPageInputs },
] = createAppSignalWithSetters(true)({
  enableLoginPageInputs: (set) => set(true),
  disableLoginPageInputs: (set) => set(false),
});
