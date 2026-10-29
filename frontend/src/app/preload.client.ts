/** Start critical downloads during Router hydration; mounting stays component-owned. */
export async function preloadStartup(pathname: string): Promise<void> {
  if (pathname.endsWith(".html")) return;
  const pending: Promise<unknown>[] = [
    import("./browser-runtime.client"),
    import("./critical-chrome.client"),
  ];
  if (pathname === "/") pending.push(import("../features/typing/page.client"));
  await Promise.all(pending);
}
