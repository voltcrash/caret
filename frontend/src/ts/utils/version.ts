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

/**
 * Release check for the version indicator. Caches are never purged here: the
 * service worker versions them per build and owns their lifetime.
 */
export async function fetchLatestVersion(): Promise<{
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
  }

  return {
    text: currentVersion,
    isNew,
  };
}
