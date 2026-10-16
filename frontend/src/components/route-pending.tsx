/** Route-owned fallback while loaders resolve; public shell remains mounted. */
export function RoutePending() {
  return (
    <div role="status" class="grid min-h-48 place-items-center text-sub">
      Loading…
    </div>
  );
}
