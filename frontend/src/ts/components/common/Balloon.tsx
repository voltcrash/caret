import type { JSX, ParentProps, ValidComponent } from "solid-js";

import { createSignal, createUniqueId, Show, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";

import { TooltipBubble } from "./TooltipBubble";

export type BalloonProps = {
  text?: string;
  position?: BalloonPosition;
  break?: boolean;
  length?: "small" | "medium" | "large" | "xlarge" | "fit";
};

export type BalloonPosition =
  | "up"
  | "down"
  | "left"
  | "right"
  | "up-left"
  | "up-right";

type Props = ParentProps<BalloonProps> &
  JSX.HTMLAttributes<HTMLElement> & {
    inline?: boolean;
    as?: ValidComponent;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    href?: string;
    target?: string;
    rel?: string;
    "router-link"?: string;
    tagid?: string;
    "data-balloon-pos"?: BalloonPosition;
    "data-balloon-length"?: string;
    "data-balloon-break"?: string | boolean;
  };

export function Balloon(props: Props) {
  const [local, rest] = splitProps(props, [
    "text",
    "position",
    "break",
    "length",
    "inline",
    "children",
    "as",
    "ref",
    "tabIndex",
    "aria-describedby",
    "data-balloon-pos",
    "data-balloon-length",
    "data-balloon-break",
  ]);
  const id = createUniqueId();
  const [reference, setReference] = createSignal<HTMLElement>();
  const text = () => local.text;
  const hasText = () => (text() ?? "") !== "";
  const position = () => local.position ?? local["data-balloon-pos"] ?? "up";
  const length = () => local.length ?? local["data-balloon-length"];
  const legacyBreaks = () => local["data-balloon-break"] !== undefined;
  const breaks = () => local.break ?? legacyBreaks();

  return (
    <>
      <Dynamic
        component={local.as ?? (local.inline ? "span" : "div")}
        {...rest}
        ref={(element: HTMLElement) => {
          setReference(element);
          if (typeof local.ref === "function") local.ref(element);
        }}
        tabIndex={local.tabIndex ?? (hasText() ? 0 : undefined)}
        aria-describedby={
          [local["aria-describedby"], hasText() ? id : undefined]
            .filter(Boolean)
            .join(" ") || undefined
        }
        data-balloon-pos={hasText() ? position() : undefined}
        data-balloon-length={length()}
        data-balloon-break={breaks() ? "" : undefined}
      >
        {local.children}
        <Show when={text()}>
          <span id={id} hidden>
            {text()}
          </span>
        </Show>
      </Dynamic>
      <Show when={text()}>
        <TooltipBubble
          reference={reference()}
          text={text() ?? ""}
          position={position()}
          length={length()}
          breaks={breaks()}
        />
      </Show>
    </>
  );
}
