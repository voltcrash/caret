/**
 * Scrolls the `[data-row]` row with this index just into view inside its
 * scroll container, keeping it clear of a sticky table head.
 */
export function scrollRowIntoView(
  container: HTMLDivElement | undefined,
  idx: number,
): void {
  if (container === undefined || idx < 0) return;
  const row = container.querySelector<HTMLElement>(`[data-row="${idx}"]`);
  if (row === null) return;
  const containerRect = container.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  const stickyHead =
    container.querySelector<HTMLElement>("thead")?.getBoundingClientRect()
      .height ?? 0;
  if (rowRect.top < containerRect.top + stickyHead) {
    container.scrollTop -= containerRect.top + stickyHead - rowRect.top;
  } else if (rowRect.bottom > containerRect.bottom) {
    container.scrollTop += rowRect.bottom - containerRect.bottom;
  }
}
