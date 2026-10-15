import type { JSXElement } from "solid-js";

import type { FaSolidIcon } from "../../ts/types/font-awesome";

import { Button } from "../../ts/components/common/Button";
import { Link } from "../../ts/components/common/Link";

const navButton =
  "aspect-square pointer-coarse:relative pointer-coarse:before:absolute pointer-coarse:before:-inset-1 pointer-coarse:before:content-['']";

/**
 * Server-rendered header with the browser header's geometry and links. The
 * interactive header (account, alerts, focus state) replaces it after hydration.
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
      <Link
        href="/"
        class="-m-2 flex h-6 w-max gap-2 rounded-[0.8rem] p-2"
        aria-label="Oxytype Home"
        style={{
          "box-sizing": "content-box",
          "font-family": "Lexend Deca ,sans-serif",
        }}
        data-ui-element="logo"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 48 48"
          aria-hidden="true"
          class="h-full fill-none stroke-current stroke-[6] text-main"
        >
          <circle cx="24" cy="24" r="16"></circle>
          <path d="M24 5v13" class="[stroke-linecap:round]"></path>
        </svg>
        <div class="hidden h-6 place-content-center text-[2rem] leading-0 sm:grid">
          <div class="-mt-[1.65em] hidden pl-[0.5em] text-[0.315em] leading-0 text-text lg:block">
            type with focus
          </div>
          <h1 class="-mt-[0.11em] text-text">oxytype</h1>
        </div>
      </Link>
      <nav
        aria-label="Main navigation"
        class="z-5 flex w-full items-center gap-0 xs:gap-1 md:gap-2"
      >
        {item("/", "fa-keyboard", "Test")}
        {item("/leaderboards", "fa-crown", "Leaderboards")}
        {item("/about", "fa-info", "About")}
        {item("/settings", "fa-cog", "Settings")}
        <div class="grow"></div>
        {item("/login", "fa-user", "Account")}
      </nav>
    </header>
  );
}
