import type { JSX } from "solid-js";

import { HeadContent, Scripts, useRouter } from "@tanstack/solid-router";
import { HydrationScript } from "solid-js/web";

import warnings from "../html/warnings.html?raw";
import { themeBootstrap } from "./theme-bootstrap";

/** Trusted static fallback source; rendered in the initial response and kept on hydration. */
export function Document(props: { children: JSX.Element }): JSX.Element {
  const router = useRouter();
  const nonce = () => router.options.ssr?.nonce;
  const fallback = () =>
    warnings
      .replaceAll("<script>", `<script nonce="${nonce() ?? ""}">`)
      .replaceAll("<style>", `<style nonce="${nonce() ?? ""}">`);
  return (
    <html lang="en">
      <head>
        <HydrationScript />
        {/* oxlint-disable-next-line solid/no-innerhtml -- Trusted static head script; validates stored preference values and uses the response nonce. */}
        <script nonce={nonce()} innerHTML={themeBootstrap}></script>
      </head>
      <body>
        <HeadContent />
        {/* oxlint-disable-next-line solid/no-innerhtml -- Repository-owned static HTML, never request/user content; preserves no-JS/no-CSS recovery. */}
        <div innerHTML={fallback()}></div>
        {props.children}
        <Scripts />
      </body>
    </html>
  );
}
