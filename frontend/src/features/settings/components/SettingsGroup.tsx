import { createUniqueId, JSXElement } from "solid-js";

import { cn } from "#shared/utils/cn.ts";

export function SettingsGroup(props: {
  title: string;
  children: JSXElement;
}): JSXElement {
  const headingId = createUniqueId();

  return (
    <section
      aria-labelledby={headingId}
      data-settings-group={props.title}
      class="grid min-w-0 gap-3 not-has-[[data-setting-key]:not(.hidden)]:hidden"
    >
      <h3 id={headingId} class="px-4 text-em-sm text-text md:px-5">
        {props.title}
      </h3>
      <div
        class={cn(
          "min-w-0 rounded-double border border-sub/20",
          "[&>[data-setting-key]]:m-0 [&>[data-setting-key]]:min-w-0 [&>[data-setting-key]]:rounded-none [&>[data-setting-key]]:border-sub/20 [&>[data-setting-key]]:p-4 md:[&>[data-setting-key]]:p-5",
          // Filtered rows should neither leave a divider above the first match
          // nor remove dividers between the remaining matches.
          "[&>[data-setting-key]:not(.hidden)~[data-setting-key]:not(.hidden)]:border-t",
        )}
      >
        {props.children}
      </div>
    </section>
  );
}
