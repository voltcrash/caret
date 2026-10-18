import { JSXElement, onCleanup, onMount, Show } from "solid-js";

import { isAnyPopupVisible } from "../../../states/overlay-visibility";
import {
  getSettingsSearch,
  setSettingsSearch,
} from "../../../states/settings-search";
import { cn } from "../../../utils/cn";
import {
  isEditableElement,
  isTypeToSearchKey,
} from "../../../utils/type-to-search";
import { Button } from "../../common/Button";
import { Fa } from "../../common/Fa";

export function SettingsSearch(): JSXElement {
  // reset the filter when leaving the settings page
  onCleanup(() => setSettingsSearch(""));

  let inputRef: HTMLInputElement | undefined;

  // type anywhere on the page to search: focusing during keydown makes the
  // browser insert the character into the input. Also works while the page
  // fades in, so typing right after navigating isn't lost.
  onMount(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (!inputRef || e.defaultPrevented) return;
      // backspace edits an existing query, e.g. after toggling a setting
      const isBackspace =
        e.key === "Backspace" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        getSettingsSearch() !== "";
      if (!isTypeToSearchKey(e) && !isBackspace) return;
      if (isEditableElement(document.activeElement)) return;
      if (isAnyPopupVisible()) return;
      inputRef.focus();
      const end = inputRef.value.length;
      inputRef.setSelectionRange(end, end);
    };
    document.addEventListener("keydown", onKeyDown);
    onCleanup(() => document.removeEventListener("keydown", onKeyDown));
  });

  return (
    <div class="relative w-full">
      <Fa
        icon="fa-search"
        class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sub"
      />
      <input
        ref={(el) => (inputRef = el)}
        class={cn(
          "w-full rounded border-none bg-bg py-3 pr-10 pl-10",
          "text-em-base text-text caret-main outline-none placeholder:text-sub",
          "focus-visible:shadow-[0_0_0_0.1rem_var(--bg-color),0_0_0_0.2rem_var(--text-color)]",
        )}
        type="text"
        aria-label="Search settings"
        placeholder="search"
        autocomplete="off"
        value={getSettingsSearch()}
        onInput={(e) => setSettingsSearch(e.currentTarget.value)}
      />
      <Show when={getSettingsSearch() !== ""}>
        <Button
          variant="text"
          class="absolute top-1/2 right-2 -translate-y-1/2"
          fa={{ icon: "fa-times" }}
          onClick={() => setSettingsSearch("")}
        >
          {/* no tooltip: it covered the search input */}
          <span class="sr-only">clear search</span>
        </Button>
      </Show>
    </div>
  );
}
