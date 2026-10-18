// oxlint-disable-next-line typescript/consistent-type-definitions -- Vite augments this interface.
interface ImportMetaEnv {
  readonly OXYTYPE_OFFLINE: boolean;
  readonly OXYTYPE_BUILD_ID: string;
  readonly OXYTYPE_SENTRY_ORIGIN: string;
}
