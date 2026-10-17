/** `force` skips restart/result checks, never no_quit. */
export type NavigateOptions = { force?: boolean };

type Navigation = {
  navigate: (
    url: string | undefined,
    options: NavigateOptions,
  ) => Promise<void>;
  replaceUrl: (url: string) => Promise<void>;
};

let navigation: Navigation | undefined;

// Imperative callers share the navigator owned by the mounted router.
export function bindNavigation(value: Navigation): () => void {
  navigation = value;
  return () => {
    if (navigation === value) navigation = undefined;
  };
}

export async function navigate(
  url?: string,
  options: NavigateOptions = {},
): Promise<void> {
  if (navigation === undefined) throw new Error("App router is not mounted");
  await navigation.navigate(url, options);
}

export async function replaceUrl(url: string): Promise<void> {
  if (navigation === undefined) throw new Error("App router is not mounted");
  await navigation.replaceUrl(url);
}
