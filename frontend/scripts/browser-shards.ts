/** Keep each spec's shared Worker state on one runner; balance by observed seconds. */
export function balanceBrowserFiles(
  files: string[],
  durations: Record<string, number>,
  count: number,
): { files: string[]; seconds: number }[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("Invalid shard count");
  }
  const recorded = Object.values(durations).filter((value) => value > 0);
  const fallback =
    recorded.length === 0
      ? 1
      : recorded.reduce((sum, value) => sum + value, 0) / recorded.length;
  const weight = (file: string): number => durations[file] ?? fallback;
  const shards = Array.from({ length: count }, () => ({
    files: [] as string[],
    seconds: 0,
  }));
  for (const file of [...new Set(files)].sort(
    (a, b) => weight(b) - weight(a) || a.localeCompare(b),
  )) {
    const shard = shards.reduce((best, candidate) =>
      candidate.seconds < best.seconds ? candidate : best,
    );
    shard.files.push(file);
    shard.seconds += weight(file);
  }
  return shards;
}
