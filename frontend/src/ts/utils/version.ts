import { z } from "zod";
import { getLatestRelease } from "./json-data";
import { LocalStorageWithSchema } from "./local-storage-with-schema";
import { tryCatch } from "@oxytype/util/trycatch";
import { isDevEnvironment } from "./env";
import { createErrorMessage } from "./error";

const memoryLS = new LocalStorageWithSchema({
  key: "lastSeenVersion",
  schema: z.string(),
  fallback: "",
});

function purgeCaches(): void {
  if (!("caches" in window)) return;
  void caches.keys().then(function (names) {
    for (const name of names) void caches.delete(name);
  });
}

/**
 * `purgeCaches` keeps the rollback build's release-change cache purge. The
 * Start service worker versions its caches per build, so purging there would
 * only discard the offline shell it just installed.
 */
export async function fetchLatestVersion(
  options: { purgeCaches: boolean } = { purgeCaches: true },
): Promise<{
  text: string;
  isNew: boolean;
} | null> {
  if (isDevEnvironment()) return null;

  const { data: currentVersion, error } = await tryCatch(getLatestRelease());

  if (error) {
    const msg = createErrorMessage(error, "Failed to fetch version number");
    console.error(msg);
    return null;
  }

  const memoryVersion = memoryLS.get();
  const isNew = memoryVersion === "" ? false : memoryVersion !== currentVersion;

  if (isNew || memoryVersion === "") {
    memoryLS.set(currentVersion);
    if (options.purgeCaches) purgeCaches();
  }

  return {
    text: currentVersion,
    isNew,
  };
}
