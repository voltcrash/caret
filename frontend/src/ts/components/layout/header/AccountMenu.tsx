import { JSXElement } from "solid-js";

import { signOut } from "../../../auth";
import { getSnapshot } from "../../../states/snapshot";
import { Button } from "../../common/Button";
export function AccountMenu(): JSXElement {
  const buttonClass =
    "w-full justify-start px-3 py-2 whitespace-nowrap gap-2 bg-transparent pointer-coarse:min-h-11";

  return (
    <div
      class="pointer-events-none absolute right-0 z-1000 w-auto text-xs opacity-0 transition-opacity duration-125"
      data-ui-element="accountMenu"
    >
      <div class="h-3"></div>
      <div
        class="grid grid-flow-row rounded bg-sub-alt ring-6 ring-bg"
        data-ui-element="accountMenu"
      >
        <Button
          text="User stats"
          class={buttonClass}
          fa={{
            icon: "fa-chart-line",
            fixedWidth: true,
          }}
          href="/account"
          router-link
        />
        <Button
          text="Public profile"
          class={buttonClass}
          fa={{
            icon: "fa-globe-americas",
            fixedWidth: true,
          }}
          href={`/profile/${getSnapshot()?.name ?? ""}`}
          router-link
        />
        <Button
          text="Account settings"
          class={buttonClass}
          fa={{
            icon: "fa-cog",
            fixedWidth: true,
          }}
          href="/settings?tab=account"
          router-link
        />
        <Button
          text="Sign out"
          class={buttonClass}
          fa={{
            icon: "fa-sign-out-alt",
            fixedWidth: true,
          }}
          onClick={() => {
            signOut();
          }}
        />
      </div>
    </div>
  );
}
