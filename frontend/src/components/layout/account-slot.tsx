import type { ParentProps } from "solid-js";

/** Account downloads must not resize the header or displace navigation. */
export function AccountSlot(props: ParentProps) {
  return (
    <div class="relative h-9 min-w-9 flex-1" data-ui-element="accountSlot">
      <div class="absolute inset-y-0 right-0 flex max-w-full items-center justify-end">
        {props.children}
      </div>
    </div>
  );
}
