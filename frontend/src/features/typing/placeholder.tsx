/** Static footprint while the browser prepares the real configured test. */
export function TypingPlaceholder() {
  return (
    <div class="page pageTest full-width content-grid relative col-[full-width] grid h-full grid-rows-[1fr_auto_1fr]" data-typing-placeholder aria-busy="true">
      <div class="full-width" aria-hidden="true">
        <div class="mx-auto mb-8 hidden h-10 w-[min(56rem,100%)] rounded-(--roundness) bg-sub-alt md:block pointer-coarse:hidden!" />
        <div class="mx-auto h-11 w-40 rounded-(--roundness) bg-sub-alt md:hidden pointer-coarse:block!" />
      </div>
      <div class="relative mx-auto w-full" style={{ "font-size": "calc(var(--startup-font-size, 2rem) * var(--words-font-scale, 1))" }}>
        <div class="grid h-[calc(4.5em+6px)] content-center" role="status">
          <p class="m-0 text-center text-base text-sub">Preparing typing test…</p>
        </div>
        <div class="mx-auto mt-8 h-8 w-8" aria-hidden="true" />
      </div>
      <div />
    </div>
  );
}
