import { Link, type LinkComponentProps } from "@tanstack/solid-router";
import {
  createContext,
  Show,
  splitProps,
  type JSX,
  type JSXElement,
} from "solid-js";
import { isServer } from "solid-js/web";

export type HostLinkProps = Omit<
  JSX.AnchorHTMLAttributes<HTMLAnchorElement>,
  "onClick"
> & {
  onClick?: (event: MouseEvent) => void;
};

/**
 * Host navigation for shared links and router-marked buttons. Start supplies
 * Router links (intent preload, blockers, modified clicks); without a host the
 * rollback app keeps its own `router-link` anchors.
 */
export const LinkHost = createContext<(props: HostLinkProps) => JSXElement>();

/** Same-origin absolute URLs become Router paths; anything else stays native. */
function routerHref(href: string | undefined): string | undefined {
  if (href === undefined || isServer) return href;
  const url = new URL(href, window.location.origin);
  return url.origin === window.location.origin
    ? url.pathname + url.search + url.hash
    : undefined;
}

export function RouterLink(props: HostLinkProps): JSXElement {
  const [local, rest] = splitProps(props, ["href", "children", "onClick"]);
  const native = (): boolean =>
    routerHref(local.href) === undefined ||
    (props.target !== undefined && props.target !== "_self") ||
    props.download !== undefined ||
    props.rel?.split(/\s+/).includes("external") === true;
  return (
    <Show
      when={!native()}
      fallback={
        <a
          {...rest}
          href={local.href}
          onClick={(event) => local.onClick?.(event)}
        >
          {local.children}
        </a>
      }
    >
      <Link
        {...(rest as LinkComponentProps)}
        href={routerHref(local.href)}
        // Shared navigation styles predate Router's `active` class.
        activeProps={{}}
        onClick={(event: MouseEvent) => local.onClick?.(event)}
      >
        {local.children}
      </Link>
    </Show>
  );
}
