/** Matches the default keyboard hints without loading browser integrations. */
export function StaticFooter() {
  return (
    <footer class="relative text-sm text-text sm:text-xs">
      <div class="mb-8 hidden flex-col items-center gap-2 pointer-fine:sm:flex">
        <div class="flex items-center gap-2"><kbd>tab</kbd><span>+</span><kbd>enter</kbd><span>- restart test</span></div>
        <div class="flex items-center gap-2"><kbd>esc</kbd><span>- command palette</span></div>
      </div>
    </footer>
  );
}
