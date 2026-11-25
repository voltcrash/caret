import type { DBSchema, IDBPDatabase } from "idb";
import { createSignal, onCleanup } from "solid-js";
import { createAppOwned } from "../../app/application";

type FileDB = DBSchema & {
  files: {
    key: string; // filename
    value: string; // the data url
  };
};

type Filename = "LocalBackgroundFile" | "LocalFontFamilyFile";

const EMPTY_HINT_KEY = "caret_local_files_empty";

function isKnownEmpty(): boolean {
  try {
    return localStorage.getItem(EMPTY_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

function setKnownEmpty(empty: boolean): void {
  try {
    if (empty) localStorage.setItem(EMPTY_HINT_KEY, "1");
    else localStorage.removeItem(EMPTY_HINT_KEY);
  } catch {
    // storage may be unavailable
  }
}

class FileStorage {
  private dbPromise: Promise<IDBPDatabase<FileDB>> | undefined;
  private closed = false;
  private signals = new Map<
    Filename,
    [get: () => number, set: (v: number | ((prev: number) => number)) => void]
  >();

  private async database(): Promise<IDBPDatabase<FileDB>> {
    if (this.closed) {
      throw new DOMException("Application disposed", "AbortError");
    }
    this.dbPromise ??= import("idb")
      .then(
        async ({ openDB }) =>
          await openDB<FileDB>("file-storage-db", 1, {
            upgrade(db) {
              if (!db.objectStoreNames.contains("files")) {
                db.createObjectStore("files");
              }
            },
            blocking: () => {
              const pending = this.dbPromise;
              this.dbPromise = undefined;
              void pending?.then((db) => db.close()).catch(() => undefined);
            },
            terminated: () => {
              this.dbPromise = undefined;
            },
          }),
      )
      .catch((error: unknown) => {
        this.dbPromise = undefined;
        throw error;
      });
    const db = await this.dbPromise;
    if (this.closed) {
      throw new DOMException("Application disposed", "AbortError");
    }
    return db;
  }

  dispose(): void {
    this.closed = true;
    void this.dbPromise?.then((db) => db.close()).catch(() => undefined);
  }

  private getSignal(
    filename: Filename,
  ): [
    get: () => number,
    set: (v: number | ((prev: number) => number)) => void,
  ] {
    let signal = this.signals.get(filename);
    if (!signal) {
      signal = createSignal(0);
      this.signals.set(filename, signal);
    }
    return signal;
  }

  private notify(filename: Filename): void {
    if (this.closed) return;
    const signal = this.signals.get(filename);
    if (signal) {
      signal[1]((v) => v + 1);
    }
  }

  /** Subscribe to changes for a filename. Call within a reactive context. Returns a version number. */
  track(filename: Filename): number {
    return this.getSignal(filename)[0]();
  }

  async storeFile(filename: Filename, dataUrl: string): Promise<void> {
    setKnownEmpty(false);
    const db = await this.database();
    await db.put("files", dataUrl, filename);
    this.notify(filename);
  }

  async getFile(filename: Filename): Promise<string | undefined> {
    if (isKnownEmpty()) return undefined;
    const db = await this.database();
    const value = await db.get("files", filename);
    if (value === undefined && (await db.count("files")) === 0) {
      setKnownEmpty(true);
    }
    return value;
  }

  async deleteFile(filename: Filename): Promise<void> {
    const db = await this.database();
    await db.delete("files", filename);
    if ((await db.count("files")) === 0) setKnownEmpty(true);
    this.notify(filename);
  }

  async listFilenames(): Promise<Filename[]> {
    if (isKnownEmpty()) return [];
    const db = await this.database();
    const keys = (await db.getAllKeys("files")) as Filename[];
    if (keys.length === 0) setKnownEmpty(true);
    return keys;
  }

  async hasFile(filename: Filename): Promise<boolean> {
    if (isKnownEmpty()) return false;
    const db = await this.database();
    return (await db.getKey("files", filename)) !== undefined;
  }
}

const storage = createAppOwned(() => {
  const value = new FileStorage();
  onCleanup(() => value.dispose());
  return value;
});

export default {
  track: (filename: Filename): number => storage().track(filename),
  storeFile: async (filename: Filename, dataUrl: string): Promise<void> =>
    storage().storeFile(filename, dataUrl),
  getFile: async (filename: Filename): Promise<string | undefined> =>
    storage().getFile(filename),
  deleteFile: async (filename: Filename): Promise<void> =>
    storage().deleteFile(filename),
  listFilenames: async (): Promise<Filename[]> => storage().listFilenames(),
  hasFile: async (filename: Filename): Promise<boolean> =>
    storage().hasFile(filename),
};
