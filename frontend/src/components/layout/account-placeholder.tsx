/** Shared by server chrome and pending account data; never implies signed-out state. */
export function AccountPlaceholder() {
  return (
    <span
      role="status"
      aria-label="Loading account"
      data-ui-element="accountPlaceholder"
      class="flex h-9 items-center gap-2 px-3"
    >
      <span
        aria-hidden="true"
        class="hidden h-3 w-16 rounded bg-sub/20 sm:block"
      ></span>
      <span aria-hidden="true" class="h-4 w-5 rounded bg-sub/20"></span>
    </span>
  );
}
