import { createHash } from "node:crypto";
import { join } from "node:path";
import { LayoutObjectSchema } from "@oxytype/schemas/layouts";
import { LanguageObjectSchema } from "@oxytype/schemas/languages";
import { QuoteDataSchema } from "@oxytype/schemas/quotes";
import { z } from "zod";

import type { Fetch } from "../api/client";
import { readJson, writeJson } from "../storage/json";

const cacheSchema = z.object({
  version: z.literal(1),
  assetVersion: z.string(),
  etag: z.string().optional(),
  lastModified: z.string().optional(),
  data: z.unknown(),
});
export type RemoteAssetOptions = {
  baseUrl: string;
  timeoutMs: number;
  fetch?: Fetch;
};

function validate(asset: string, value: unknown): unknown {
  if (asset.startsWith("challenges/")) {
    return z.string().min(1).max(1_000_000).parse(value);
  }
  if (asset.startsWith("layouts/")) return LayoutObjectSchema.parse(value);
  const name = asset.split("/")[1]?.replace(/\.json$/, "");
  if (asset.startsWith("languages/")) {
    const data = LanguageObjectSchema.parse(value);
    if (data.name !== name) throw new Error("Language asset name differs");
    return data;
  }
  const data = QuoteDataSchema.parse(value);
  if (data.language !== name) throw new Error("Quote asset language differs");
  return data;
}

/** Origin-scoped cache with release versions and conditional HTTP validation. */
export function createRemoteAssets(
  cacheDir: string,
  options: RemoteAssetOptions,
): (asset: string) => Promise<unknown> {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const scope = createHash("sha256").update(baseUrl).digest("hex").slice(0, 16);
  const directory = join(cacheDir, "remote", scope);
  const fetcher = options.fetch ?? (async (input, init) => fetch(input, init));
  const assets = new Map<string, Promise<unknown>>();
  let version: Promise<string> | undefined;
  async function request(
    path: string,
    headers?: HeadersInit,
  ): Promise<{ response: Response; data?: unknown }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const response = await fetcher(`${baseUrl}/${path}`, {
        headers,
        credentials: "omit",
        redirect: "error",
        signal: controller.signal,
      });
      return {
        response,
        ...(response.status === 200
          ? {
              data: path.startsWith("challenges/")
                ? await response.text()
                : ((await response.json()) as unknown),
            }
          : {}),
      };
    } finally {
      clearTimeout(timer);
    }
  }
  async function releaseVersion(): Promise<string> {
    version ??= (async () => {
      const { response, data } = await request("version.json");
      if (response.status !== 200) throw new Error("Asset version unavailable");
      return z.object({ version: z.string().min(1) }).parse(data).version;
    })().catch((error: unknown) => {
      version = undefined;
      throw error;
    });
    return await version;
  }
  async function load(asset: string): Promise<unknown> {
    const file = join(directory, asset);
    const stored = await readJson(file, cacheSchema);
    let cached: z.infer<typeof cacheSchema> | undefined;
    if (stored.status === "ok") {
      try {
        cached = { ...stored.value, data: validate(asset, stored.value.data) };
      } catch {
        /* Invalid cached data is replaced only by a validated download. */
      }
    }
    try {
      const assetVersion = await releaseVersion();
      const headers = new Headers({ accept: "application/json" });
      if (cached?.etag !== undefined) {
        headers.set("if-none-match", cached.etag);
      } else if (cached?.lastModified !== undefined) {
        headers.set("if-modified-since", cached.lastModified);
      }
      const { response, data } = await request(asset, headers);
      if (response.status === 304 && cached !== undefined) {
        await writeJson(file, { ...cached, assetVersion });
        return cached.data;
      }
      if (response.status !== 200) {
        throw new Error(`Asset download failed (${response.status})`);
      }
      const validated = validate(asset, data);
      await writeJson(file, {
        version: 1,
        assetVersion,
        data: validated,
        etag: response.headers.get("etag") ?? undefined,
        lastModified: response.headers.get("last-modified") ?? undefined,
      });
      return validated;
    } catch (error) {
      if (cached !== undefined) return cached.data;
      throw error;
    }
  }
  return async (asset) => {
    let pending = assets.get(asset);
    if (pending === undefined) {
      pending = load(asset).catch((error: unknown) => {
        assets.delete(asset);
        throw error;
      });
      assets.set(asset, pending);
    }
    return await pending;
  };
}
