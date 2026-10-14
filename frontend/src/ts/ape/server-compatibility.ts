// Kept apart from the ts-rest adapter so the footer can read it without
// loading the API client.
let lastSeen: number | undefined;

export function getLastSeenServerCompatibility(): number | undefined {
  return lastSeen;
}

export function setLastSeenServerCompatibility(version: number): void {
  lastSeen = version;
}
