import { createBinding } from "./binding";

/** `force` skips restart/result checks, never no_quit. */
export type NavigateOptions = { force?: boolean };

type Navigation = {
  navigate: (
    url: string | undefined,
    options: NavigateOptions,
  ) => Promise<void>;
  replaceUrl: (url: string) => Promise<void>;
};

// Imperative callers share the navigator owned by the mounted router.
const navigation = createBinding<Navigation>();
export const bindNavigation = navigation.bind;

export async function navigate(
  url?: string,
  options: NavigateOptions = {},
): Promise<void> {
  await navigation.require("App router is not mounted").navigate(url, options);
}

export async function replaceUrl(url: string): Promise<void> {
  await navigation.require("App router is not mounted").replaceUrl(url);
}
