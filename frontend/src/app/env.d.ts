// oxlint-disable-next-line typescript/consistent-type-definitions -- Vite augments this interface.
interface ImportMetaEnv {
  readonly CARET_ENGINE_PROOF: boolean;
  readonly CARET_OFFLINE: boolean;
  readonly CARET_BUILD_ID: string;
  readonly CARET_SENTRY_ORIGIN: string;
}
