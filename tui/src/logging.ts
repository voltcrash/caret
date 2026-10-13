import { chmod, mkdir, open, rename, stat } from "node:fs/promises";
import { dirname } from "node:path";

type Level = "debug" | "info" | "error";
type Metadata = Record<string, string | number | boolean | undefined>;
export type Logger = {
  write: (level: Level, event: string, metadata?: Metadata) => void;
  error: (event: string, error: unknown) => void;
  flush: () => Promise<void>;
};

/** No error messages, request bodies, URLs, tokens or typed text enter logs. */
function errorDetails(error: unknown): Metadata {
  if (!(error instanceof Error)) return { name: "UnknownError" };
  const name = /^[a-zA-Z]+Error$/.test(error.name) ? error.name : "Error";
  return {
    name,
    code:
      "code" in error &&
      typeof error.code === "string" &&
      /^[A-Z_]+$/.test(error.code)
        ? error.code
        : undefined,
    status:
      "status" in error && typeof error.status === "number"
        ? error.status
        : undefined,
  };
}

export function createLogger(
  file: string,
  options: {
    debug?: boolean;
    maxBytes?: number;
    now?: () => Date;
    onFailure?: () => void;
  } = {},
): Logger {
  let pending = Promise.resolve();
  let warned = false;
  const maxBytes = options.maxBytes ?? 1024 * 1024;
  function write(level: Level, event: string, metadata: Metadata = {}): void {
    if (level === "debug" && options.debug !== true) return;
    const line = `${JSON.stringify({
      time: (options.now ?? (() => new Date()))().toISOString(),
      level,
      event,
      ...metadata,
    })}\n`;
    const append = async (): Promise<void> => {
      await mkdir(dirname(file), { recursive: true, mode: 0o700 });
      const size = await stat(file).then(
        (info) => info.size,
        (error: unknown) => {
          if (errorDetails(error)["code"] === "ENOENT") return 0;
          throw error;
        },
      );
      if (size > 0 && size + Buffer.byteLength(line) > maxBytes) {
        await rename(file, `${file}.1`);
        await chmod(`${file}.1`, 0o600);
      }
      const handle = await open(file, "a", 0o600);
      try {
        await handle.chmod(0o600);
        await handle.writeFile(line);
      } finally {
        await handle.close();
      }
    };
    pending = pending.then(append, append);
    void pending.catch(() => {
      if (warned) return;
      warned = true;
      options.onFailure?.();
    });
  }
  return {
    write,
    error: (event, error) => write("error", event, errorDetails(error)),
    flush: async () => pending,
  };
}
