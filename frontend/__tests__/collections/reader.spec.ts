import {
  createCollection,
  localOnlyCollectionOptions,
} from "@tanstack/solid-db";
import { createEffect, createRoot, untrack } from "solid-js";
import { describe, expect, it } from "vite-plus/test";
import {
  createCollectionReader,
  type CollectionReader,
} from "../../src/ts/collections/utils/reader";
import { mountApplication } from "../../src/app/application";
import {
  createTestApplication,
  releaseTestApplication,
} from "../__harness__/mock-application";

releaseTestApplication();

type Item = { id: string; name: string };

function setup(): {
  collection: ReturnType<typeof createItems>;
  reader: CollectionReader<Item, string>;
  dispose: () => void;
} {
  const { application, dispose: disposeApplication } = createTestApplication();
  const release = mountApplication(application);
  const collection = createItems();
  const reader = createCollectionReader(() => collection);
  return {
    collection,
    reader,
    dispose: () => {
      release();
      disposeApplication();
    },
  };
}

function createItems() {
  return createCollection(
    localOnlyCollectionOptions<Item>({
      getKey: (it) => it.id,
      initialData: [{ id: "a", name: "alpha" }],
    }),
  );
}

describe("createCollectionReader", () => {
  it("reads current values synchronously", () => {
    const { collection, reader, dispose } = setup();
    expect(reader.values()).toMatchObject([{ id: "a", name: "alpha" }]);

    collection.insert({ id: "b", name: "beta" });
    expect(reader.values().map((it) => it.id)).toEqual(["a", "b"]);
    expect(reader.get("b")?.name).toBe("beta");
    expect(reader.get("missing")).toBeUndefined();
    dispose();
  });

  it("tracks changes inside reactive scopes", () => {
    const { collection, reader, dispose } = setup();
    const seen: string[][] = [];
    const names: (string | undefined)[] = [];
    const disposeRoot = createRoot((disposeRoot) => {
      createEffect(() => seen.push(reader.values().map((it) => it.id)));
      createEffect(() => names.push(reader.get("a")?.name));
      return disposeRoot;
    });

    collection.insert({ id: "b", name: "beta" });
    collection.update("a", (it) => {
      it.name = "renamed";
    });

    expect(seen.at(-1)).toEqual(["a", "b"]);
    expect(names.at(-1)).toBe("renamed");
    disposeRoot();
    dispose();
  });

  it("does not track reads wrapped in untrack", () => {
    const { collection, reader, dispose } = setup();
    let runs = 0;
    const disposeRoot = createRoot((disposeRoot) => {
      createEffect(() => {
        untrack(() => reader.values());
        runs++;
      });
      return disposeRoot;
    });

    collection.insert({ id: "b", name: "beta" });
    expect(runs).toBe(1);
    disposeRoot();
    dispose();
  });

  it("subscribes on first read until its scope is disposed", () => {
    const { collection, reader, dispose } = setup();
    expect(collection.subscriberCount).toBe(0);
    reader.values();
    reader.get("a");
    expect(collection.subscriberCount).toBe(1);
    dispose();
    expect(collection.subscriberCount).toBe(0);
  });
});
