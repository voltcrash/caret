/** Matches the default keyboard hints without loading browser integrations. */
export function StaticFooter() {
  return (
    <footer class="relative text-sm text-text sm:text-xs">
      <div class="mb-8 hidden flex-col items-center gap-2 pointer-fine:sm:[display:var(--startup-keytips-display,none)]">
        <div class="flex items-center gap-2"><kbd>tab &gt; enter</kbd><span>- restart test</span></div>
        <div class="flex items-center gap-2"><kbd>esc</kbd><span>or</span><kbd>ctrl + shift + p</kbd><span>- command palette</span></div>
      </div>
    </footer>
  );
}
