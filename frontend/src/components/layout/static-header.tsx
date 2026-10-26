import type { JSXElement } from "solid-js";

import type { FaSolidIcon } from "../../ts/types/font-awesome";

import { Button } from "../../ts/components/common/Button";
import { Link } from "../../ts/components/common/Link";
import { OxytypeMark } from "../brand/oxytype-mark";

const navButton =
  "aspect-square pointer-coarse:relative pointer-coarse:before:absolute pointer-coarse:before:-inset-1 pointer-coarse:before:content-['']";

/**
 * Server-rendered header with the browser header's geometry and links. The
 * interactive header (account, focus state) replaces it after hydration.
 */
export function StaticHeader(props: { fixed: boolean }): JSXElement {
  const item = (href: string, icon: FaSolidIcon, label: string) => (
    <Button
      variant="text"
      fa={{ icon, fixedWidth: true }}
      router-link
      href={href}
      class={navButton}
      dataset={{ "data-nav-item": label.toLowerCase(), "aria-label": label }}
    />
  );
  return (
    <header
      class={
        props.fixed
          ? "relative z-20 -mt-[max(2rem,env(safe-area-inset-top,0px))] -mb-4 flex place-items-center gap-2 pt-[max(2rem,env(safe-area-inset-top,0px))] pb-4"
          : "flex place-items-center gap-2"
      }
      data-ui-element="header"
    >
      <div
        class="relative flex h-6 w-max"
        style={{ "font-family": "Lexend Deca ,sans-serif" }}
        data-ui-element="logo"
      >
        <Link
          href="/"
          class="-m-2 flex h-6 items-center gap-2 rounded-[0.8rem] p-2"
          aria-label="Oxytype Home"
          style={{ "box-sizing": "content-box" }}
        >
          <OxytypeMark class="h-full w-6 shrink-0 fill-current text-main" />
          <div class="hidden h-6 place-content-center text-[2rem] leading-0 sm:grid">
            <h1 class="-mt-[0.11em] text-text">oxytype</h1>
          </div>
        </Link>
      </div>
      <nav
        aria-label="Main navigation"
        class="z-5 flex w-full items-center gap-0 xs:gap-1 md:gap-2"
      >
        {item("/leaderboards", "fa-crown", "Leaderboards")}
        <Button
          variant="text"
          fa={{ icon: "fa-github", variant: "brand", fixedWidth: true }}
          href="https://github.com/voltcrash/oxytype"
          class={navButton}
          dataset={{ "data-nav-item": "github", "aria-label": "GitHub" }}
        />
        {item("/settings", "fa-cog", "Settings")}
        <div class="grow"></div>
        {item("/login", "fa-user", "Account")}
      </nav>
    </header>
  );
}
