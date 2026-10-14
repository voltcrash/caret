let ready: (() => boolean) | undefined;

export function bindResultsReady(reader: () => boolean): void {
  ready = reader;
}

export function isResultsReady(): boolean {
  return ready?.() ?? false;
}
