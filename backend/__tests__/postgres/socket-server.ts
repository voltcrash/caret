import { createServer, type Server } from "node:net";
import { PGLiteSocketHandler } from "@electric-sql/pglite-socket";
import type { PGlite } from "@electric-sql/pglite";

type Job = {
  id: number;
  message: Uint8Array;
  onData: (data: Uint8Array) => void;
  resolve: (bytes: number) => void;
  reject: (error: unknown) => void;
};

/** PGlite has one backend: multiplex complete queries, never Parse/Bind fragments. */
class ProtocolQueue {
  private readonly db: PGlite;
  private readonly fragments = new Map<number, Uint8Array[]>();
  private readonly jobs: Job[] = [];
  private owner: number | undefined;
  private processing = false;
  constructor(db: PGlite) {
    this.db = db;
  }
  async enqueue(
    id: number,
    message: Uint8Array,
    onData: Job["onData"],
  ): Promise<number> {
    const kind = String.fromCharCode(message[0] ?? 0);
    if (kind === "X") return 0;
    if (!["\0", "Q", "S"].includes(kind)) {
      const parts = this.fragments.get(id) ?? [];
      parts.push(message);
      this.fragments.set(id, parts);
      return 0;
    }
    const parts = this.fragments.get(id) ?? [];
    this.fragments.delete(id);
    const full = Buffer.concat([...parts, message]);
    return await new Promise<number>((resolve, reject) => {
      this.jobs.push({ id, message: full, onData, resolve, reject });
      void this.drain();
    });
  }
  private async drain(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      while (this.jobs.length > 0) {
        const index =
          this.owner === undefined
            ? 0
            : this.jobs.findIndex((job) => job.id === this.owner);
        if (index < 0) break;
        const job = this.jobs.splice(index, 1)[0];
        if (job === undefined) break;
        try {
          let bytes = 0;
          await this.db.runExclusive(
            async () =>
              await this.db.execProtocolRawStream(job.message, {
                onRawData: (data) => {
                  bytes += data.length;
                  job.onData(data);
                },
              }),
          );
          this.owner = this.db.isInTransaction() ? job.id : undefined;
          job.resolve(bytes);
        } catch (error) {
          job.reject(error);
        }
      }
    } finally {
      this.processing = false;
    }
  }
  clearQueueForHandler(id: number): void {
    this.fragments.delete(id);
    for (let index = this.jobs.length - 1; index >= 0; index--) {
      if (this.jobs[index]?.id === id) {
        this.jobs.splice(index, 1)[0]?.reject(new Error("Client disconnected"));
      }
    }
  }
  async clearTransactionIfNeeded(id: number): Promise<void> {
    if (this.owner === id) {
      await this.db.exec("ROLLBACK");
      this.owner = undefined;
      await this.drain();
    }
  }
}

export class TestSocketServer {
  private readonly server: Server;
  private readonly handlers = new Set<PGLiteSocketHandler>();
  private readonly db: PGlite;
  constructor(db: PGlite) {
    this.db = db;
    const queue = new ProtocolQueue(db);
    this.server = createServer((socket) => {
      // The library's queue type has private fields; this test adapter implements
      // its public protocol while grouping extended-query messages through Sync.
      const queryQueue = queue as unknown as ConstructorParameters<
        typeof PGLiteSocketHandler
      >[0]["queryQueue"];
      const handler = new PGLiteSocketHandler({
        queryQueue,
        closeOnDetach: true,
      });
      this.handlers.add(handler);
      handler.addEventListener("close", () => this.handlers.delete(handler));
      void handler.attach(socket);
    });
  }
  async start(): Promise<void> {
    await this.db.waitReady;
    await new Promise<void>((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(0, "127.0.0.1", resolve);
    });
  }
  getServerConn(): string {
    const address = this.server.address();
    if (address === null || typeof address === "string") {
      throw new Error("Socket server not ready");
    }
    return `127.0.0.1:${address.port}`;
  }
  async stop(): Promise<void> {
    for (const handler of this.handlers) await handler.detach(true);
    await new Promise<void>((resolve, reject) =>
      this.server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}
