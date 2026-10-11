export type EnvConfig = {
  backendUrl: string;
  isDevelopment: boolean;
  devTools: boolean;
  devPrefetch: boolean;
  devOffline: boolean;
  clientVersion: string;
  turnstileSiteKey: string;
  authProviders: ("google" | "github")[];
  sentryDsn?: string;
};

declare module "virtual:env-config" {
  export const envConfig: EnvConfig;
}
