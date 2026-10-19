import { JSXElement, Show } from "solid-js";

import { cn } from "../../utils/cn";

function LogoContent(props: { label?: string; focus?: boolean }): JSXElement {
  return (
    <>
      <div
        class={cn(
          "icon grid w-10 items-center bg-transparent [&_svg_path]:transition-[fill]",
          props.focus ? "[&_svg_path]:fill-sub" : "[&_svg_path]:fill-main",
        )}
      >
        <img src="/images/favicon/oxytype.svg" alt="" width="40" height="40" />
      </div>
      <div class="text relative -mt-[0.23em] [font-family:'Lexend_Deca',sans-serif] text-[1.5rem] leading-[1.5rem] font-normal transition-colors sm:text-[2rem] sm:leading-[2rem]">
        oxytype
        <Show when={props.label}>
          {" "}
          <span class="text-main">{props.label}</span>
        </Show>
      </div>
    </>
  );
}

export function StandaloneHeader(props: {
  label?: string;
  focus?: boolean;
  homeLink?: boolean;
}): JSXElement {
  const logoClass =
    "-mx-1 grid cursor-pointer grid-cols-[auto_1fr] gap-2 px-1 py-[0.35rem] text-text no-underline transition-none whitespace-normal select-none sm:whitespace-nowrap";
  return (
    <header
      class={cn(
        "grid grid-flow-col grid-cols-[auto_1fr] items-center gap-2 leading-[2.3rem] select-none [grid-template-areas:'logo_menu']",
        props.focus && "focus",
        props.label !== undefined && props.label !== ""
          ? "text-[2.5rem]"
          : "text-[2.3rem]",
      )}
      onClick={() => {
        if (!props.homeLink) window.location.href = "/";
      }}
    >
      <Show
        when={props.homeLink}
        fallback={
          <div id="logo" class={logoClass}>
            <LogoContent label={props.label} focus={props.focus} />
          </div>
        }
      >
        <a id="logo" href="/" router-link="" class={logoClass}>
          <LogoContent focus={props.focus} />
        </a>
      </Show>
    </header>
  );
}
