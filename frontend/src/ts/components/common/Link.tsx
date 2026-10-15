import { JSXElement, splitProps, useContext } from "solid-js";
import { Dynamic } from "solid-js/web";

import { type HostLinkProps, LinkHost } from "../../../components/link-host";
import { cn } from "../../utils/cn";

function RollbackLink(props: HostLinkProps): JSXElement {
  const [local, rest] = splitProps(props, ["onClick", "class"]);
  return (
    <a
      {...rest}
      class={cn(local.class)}
      router-link
      {...{ link: true, noScroll: true }}
      onClick={(event) => local.onClick?.(event)}
    >
      {props.children}
    </a>
  );
}

export function Link(props: HostLinkProps): JSXElement {
  const host = useContext(LinkHost) ?? RollbackLink;
  const [local, rest] = splitProps(props, ["class"]);
  return <Dynamic component={host} {...rest} class={cn(local.class)} />;
}
