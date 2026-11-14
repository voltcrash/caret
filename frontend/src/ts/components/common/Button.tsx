import { JSXElement, Show } from "solid-js";

import { cn } from "../../utils/cn";
import { Balloon, BalloonProps } from "./Balloon";
import { Fa, FaProps } from "./Fa";
import { Link } from "./Link";

type BaseProps = {
  id?: string;
  text?: string;
  fa?: FaProps;
  class?: string;
  variant?: "text" | "button";
  children?: JSXElement;
  balloon?: BalloonProps;
  "router-link"?: true;
  onClick?: (e: MouseEvent) => void;
  type?: HTMLButtonElement["type"];
  onMouseEnter?: (e: MouseEvent) => void;
  onMouseLeave?: (e: MouseEvent) => void;
  dataset?: Record<string, string>;
  active?: boolean;
  tabIndex?: number;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-pressed"?: boolean;
};

export type ButtonProps = BaseProps & {
  type?: "button" | "submit" | "reset";
  href?: never;
  sameTarget?: true;
  disabled?: boolean;
  danger?: boolean;
};

type AnchorProps = BaseProps & {
  href: string;
  // onClick?: never;
  disabled?: never;
  type?: never;
};

export function Button(props: ButtonProps | AnchorProps): JSXElement {
  const isAnchor = (): boolean => "href" in props;
  const isActive = (): boolean =>
    (!isAnchor() && !("href" in props) && props.active) ?? false;

  const variant = () => props.variant ?? "button";

  const content = (
    <>
      <Show when={props.fa !== undefined}>
        <Fa {...(props.fa as FaProps)} />
      </Show>
      <Show when={props.text !== undefined}>{props.text}</Show>
      {props.children}
    </>
  );

  const fallbackName = () =>
    props.text === undefined && props.children === undefined
      ? props.balloon?.text
      : undefined;
  const accessibleName = () => props["aria-label"] ?? fallbackName();

  const getClasses = (): string => {
    return cn(
      "inline-flex h-min cursor-pointer appearance-none items-center justify-center gap-[0.5em] rounded border-0 p-[0.5em] text-center leading-[1.25] text-text transition-[color,background,opacity] duration-125 ease-in-out select-none",
      "focus-visible:shadow-[0_0_0_0.1rem_var(--bg-color),_0_0_0_0.2rem_var(--text-color)] focus-visible:outline-none",
      "bg-(--themable-button-bg) text-(--themable-button-text) hover:bg-(--themable-button-hover-bg) hover:text-(--themable-button-hover-text)",
      "[--themable-button-active:var(--main-color)]",
      variant() === "text" &&
        "[--themable-button-bg:transparent] [--themable-button-hover-bg:transparent] [--themable-button-hover-text:var(--text-color)] [--themable-button-text:var(--text-color)] active:text-text",
      variant() === "button" &&
        "[--themable-button-bg:var(--sub-alt-color)] [--themable-button-hover-bg:var(--text-color)] [--themable-button-hover-text:var(--bg-color)] [--themable-button-text:var(--text-color)] active:bg-sub",
      // fingers need ~44px, filled buttons are often only ~27px tall
      variant() === "button" && "pointer-coarse:min-h-11",
      variant() === "button" &&
        isActive() &&
        "[--themable-button-bg:var(--themable-button-active)] [--themable-button-hover-bg:var(--text-color)] [--themable-button-hover-text:var(--bg-color)] [--themable-button-text:var(--bg-color)]",
      variant() === "text" &&
        isActive() &&
        "[--themable-button-hover-text:var(--themable-button-hover-text)] [--themable-button-text:var(--themable-button-active)]",
      !isAnchor() &&
        (props as ButtonProps).danger &&
        "[--themable-button-bg:var(--error-color)] [--themable-button-hover-bg:var(--text-color)] [--themable-button-hover-text:var(--bg-color)] [--themable-button-text:var(--bg-color)]",
      {
        "pointer-events-none opacity-[0.33]": props.disabled,
      },
      {
        [props.class ?? ""]: props.class !== undefined,
      },
    );
  };

  return (
    <Show
      when={isAnchor()}
      fallback={
        <Balloon
          as="button"
          {...props.balloon}
          // oxlint-disable-next-line button-has-type -- Typed button props restrict type to button/submit/reset and default to button.
          type={(props as ButtonProps).type ?? "button"}
          id={props.id}
          class={getClasses()}
          aria-label={accessibleName()}
          aria-labelledby={props["aria-labelledby"]}
          aria-pressed={props["aria-pressed"]}
          onClick={(e: MouseEvent) => props.onClick?.(e)}
          onMouseEnter={(e) => props.onMouseEnter?.(e)}
          onMouseLeave={(e) => props.onMouseLeave?.(e)}
          {...(props["router-link"] ? { "router-link": "" } : {})}
          disabled={props.disabled ?? false}
          data-ui-variant={variant()}
          data-ui-element="button"
          tabIndex={props.tabIndex ?? 0}
          {...props.dataset}
        >
          {content}
        </Balloon>
      }
    >
      <Balloon
        {...props.balloon}
        as={props["router-link"] ? Link : "a"}
        id={props.id}
        class={getClasses()}
        aria-label={accessibleName()}
        aria-labelledby={props["aria-labelledby"]}
        href={props.href}
        target={
          props["router-link"] || props.href?.startsWith("#")
            ? undefined
            : "_blank"
        }
        rel={
          props["router-link"] || props.href?.startsWith("#")
            ? undefined
            : "noreferrer noopener"
        }
        {...(props["router-link"] ? { "router-link": "" } : {})}
        onClick={(e: MouseEvent) => props.onClick?.(e)}
        onMouseEnter={(e) => props.onMouseEnter?.(e)}
        onMouseLeave={(e) => props.onMouseLeave?.(e)}
        data-ui-variant={variant()}
        data-ui-element="button"
        {...props.dataset}
      >
        {content}
      </Balloon>
    </Show>
  );
}
