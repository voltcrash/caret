import { JSXElement, splitProps, useContext } from "solid-js";
import { Dynamic } from "solid-js/web";

import { type HostLinkProps, LinkHost } from "../../../components/link-host";
import { cn } from "../../utils/cn";

/** Outside the app layout (isolated components, Storybook): a plain anchor. */
function PlainLink(props: HostLinkProps): JSXElement {
  const [local, rest] = splitProps(props, ["onClick"]);
  return (
    <a {...rest} onClick={(event) => local.onClick?.(event)}>
      {props.children}
    </a>
  );
}

export function Link(props: HostLinkProps): JSXElement {
  const host = useContext(LinkHost) ?? PlainLink;
  const [local, rest] = splitProps(props, ["class"]);
  return <Dynamic component={host} {...rest} class={cn(local.class)} />;
}
