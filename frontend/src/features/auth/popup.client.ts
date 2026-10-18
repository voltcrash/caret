import { envConfig } from "virtual:env-config";
import type { SocialProvider } from "../../ts/auth-types";
import { createEvent } from "../../ts/hooks/createEvent";
type OAuthRequest = {
  provider: SocialProvider;
  link: boolean;
  rememberMe: boolean;
  resolve: () => void;
  reject: (error: Error) => void;
};
export const oauthRequestEvent = createEvent<OAuthRequest>();
export async function requestOAuth(
  provider: SocialProvider,
  link = false,
  rememberMe = true,
): Promise<void> {
  if (envConfig.devOffline) {
    throw new Error(
      "Authentication is unavailable in frontend-only development",
    );
  }
  return new Promise((resolve, reject) =>
    oauthRequestEvent.dispatch({ provider, link, rememberMe, resolve, reject }),
  );
}
