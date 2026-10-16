import { createServer } from "node:http";
import type { MiniflareOptions } from "miniflare";
import {
  createWorkerd,
  seedSession,
  enableConfiguration,
} from "../__tests__/start/workerd";

const origin = "http://127.0.0.1:4186";
async function main(): Promise<void> {
  const options: MiniflareOptions[] = [];
  const builds = await Promise.all(
    ["update-a", "update-b"].map(
      async (build) =>
        await createWorkerd(
          false,
          undefined,
          false,
          { FRONTEND_URL: origin, BETTER_AUTH_URL: `${origin}/api/auth` },
          { build, onOptions: (config) => options.push(config) },
        ),
    ),
  );
  const active = builds[0];
  if (active === undefined) throw new Error("Missing initial deployment");
  await builds[1]?.dispose();
  const session = await seedSession(active, "a");
  const db = await active.getD1Database("DB", "a");
  await enableConfiguration(active, "a", "$.results", {
    savingEnabled: true,
    objectHashCheckEnabled: true,
  });
  const data = {
    _id: "1234567890abcdef12345678",
    uid: session.uid,
    name: "UpdateFixture",
    email: "update@example.test",
    addedAt: 0,
    timeTyping: 1,
    personalBests: { time: {}, words: {}, quote: {}, zen: {}, custom: {} },
    testActivity: {},
  };
  await db
    .prepare(
      "INSERT INTO users(uid,id,name,name_key,email,added_at,time_typing,data) VALUES(?,?,?,'updatefixture',?,0,1,?)",
    )
    .bind(session.uid, data._id, data.name, data.email, JSON.stringify(data))
    .run();
  await db
    .prepare("INSERT INTO configs(uid,id,data) VALUES(?,'update-config',?)")
    .bind(
      session.uid,
      JSON.stringify({
        mode: "words",
        words: 15,
        quickRestart: "off",
        smoothCaret: "off",
      }),
    )
    .run();
  let selected = 0;
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", origin);
      if (
        request.method === "POST" &&
        /^\/__fixture\/deploy\/[ab]$/.test(url.pathname)
      ) {
        const next = url.pathname.endsWith("b") ? 1 : 0;
        if (selected !== next) {
          const config = options[next];
          if (config === undefined) {
            throw new Error("Missing deployment configuration");
          }
          await active.setOptions(config);
          selected = next;
        }
        response.writeHead(204).end();
        return;
      }
      if (url.pathname === "/__fixture/session") {
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ cookie: session.cookie }));
        return;
      }
      if (url.pathname === "/__fixture/results") {
        const current = await active.getD1Database("DB", "a");
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            count: await current
              .prepare("SELECT count(*) AS n FROM results")
              .first<number>("n"),
          }),
        );
        return;
      }
      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (value !== undefined) {
          headers.set(key, Array.isArray(value) ? value.join(", ") : value);
        }
      }
      const body: Uint8Array[] = [];
      for await (const part of request) body.push(part as Uint8Array);
      const result = await active.dispatchFetch(url.href, {
        method: request.method,
        headers,
        ...(body.length > 0 ? { body: Buffer.concat(body) } : {}),
      });
      response.statusCode = result.status;
      for (const [key, value] of result.headers) {
        if (key !== "set-cookie") response.setHeader(key, value);
      }
      if (result.headers.has("set-cookie")) {
        response.setHeader("set-cookie", result.headers.getSetCookie());
      }
      response.end(Buffer.from(await result.arrayBuffer()));
    } catch (error) {
      console.error(error);
      response.writeHead(500).end("Fixture proxy failed");
    }
  });
  server.listen(4186, "127.0.0.1");
  const close = async (): Promise<void> => {
    server.close();
    await active.dispose();
    process.exit();
  };
  process.on("SIGTERM", () => void close());
  process.on("SIGINT", () => void close());
}
void main();
