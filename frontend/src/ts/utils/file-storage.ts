import { openDB, DBSchema, IDBPDatabase } from "idb";
import { createSignal, onCleanup } from "solid-js";
import { createAppOwned } from "../../app/application";

type FileDB = DBSchema & {
  files: {
    key: string; // filename
    value: string; // the data url
  };
};

type Filename = "LocalBackgroundFile" | "LocalFontFamilyFile";

class FileStorage {
  private dbPromise: Promise<IDBPDatabase<FileDB>> | undefined;
  private closed = false;
  private signals = new Map<
    Filename,
    [get: () => number, set: (v: number | ((prev: number) => number)) => void]
  >();

  private async database(): Promise<IDBPDatabase<FileDB>> {
    this.dbPromise ??= openDB<FileDB>("file-storage-db", 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("files")) {
          db.createObjectStore("files");
        }
      },
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
    const db = await this.database();
    await db.put("files", dataUrl, filename);
    this.notify(filename);
  }

  async getFile(filename: Filename): Promise<string | undefined> {
    const db = await this.database();
    return db.get("files", filename);
  }

  async deleteFile(filename: Filename): Promise<void> {
    const db = await this.database();
    await db.delete("files", filename);
    this.notify(filename);
  }

  async listFilenames(): Promise<Filename[]> {
    const db = await this.database();
    return db.getAllKeys("files") as Promise<Filename[]>;
  }

  async hasFile(filename: Filename): Promise<boolean> {
    return (await this.getFile(filename)) !== undefined;
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
