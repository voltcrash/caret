import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vite-plus/test";
import { z } from "zod/v3";
import { LocalStorageWithSchema } from "../../src/ts/utils/local-storage-with-schema";

describe("local-storage-with-schema.ts", () => {
  describe("LocalStorageWithSchema", () => {
    const objectSchema = z.object({
      punctuation: z.boolean(),
      mode: z.enum(["words", "time"]),
      fontSize: z.number(),
    });

    const defaultObject: z.infer<typeof objectSchema> = {
      punctuation: true,
      mode: "words",
      fontSize: 16,
    };

    let ls = new LocalStorageWithSchema({
      key: "config",
      schema: objectSchema,
      fallback: defaultObject,
    });

    const getItemMock = vi.fn();
    const setItemMock = vi.fn();
    const removeItemMock = vi.fn();

    vi.stubGlobal("localStorage", {
      getItem: getItemMock,
      setItem: setItemMock,
      removeItem: removeItemMock,
    });

    afterEach(() => {
      getItemMock.mockClear();
      setItemMock.mockClear();
      removeItemMock.mockClear();
    });

    beforeEach(() => {
      ls = new LocalStorageWithSchema({
        key: "config",
        schema: objectSchema,
        fallback: defaultObject,
      });
    });

    describe("set", () => {
      it("should save to localStorage if schema is correct and return true", () => {
        const res = ls.set(defaultObject);

        expect(localStorage.setItem).toHaveBeenCalledWith(
          "config",
          JSON.stringify(defaultObject),
        );
        expect(res).toBe(true);
      });

      it("should fail to save to localStorage if schema is incorrect and return false", () => {
        const obj = {
          hi: "hello",
        };

        const res = ls.set(obj as any);

        expect(localStorage.setItem).not.toHaveBeenCalled();
        expect(res).toBe(false);
      });

      it("should update cache on set", () => {
        ls.set(defaultObject);

        expect(ls.get()).toStrictEqual(defaultObject);

        const update = { ...defaultObject, fontSize: 5 };
        ls.set(update);
        getItemMock.mockReset();

        expect(ls.get()).toStrictEqual(update);

        expect(getItemMock).not.toHaveBeenCalled();
      });

      it("should get last valid value if schema is incorrect", () => {
        ls.set(defaultObject);
        getItemMock.mockReset();

        ls.set({ hi: "hello" } as any);

        expect(ls.get()).toEqual(defaultObject);

        expect(setItemMock).toHaveBeenCalledOnce();
        expect(getItemMock).not.toHaveBeenCalled();
      });

      it("should not set if value has not changed", () => {
        ls.set(defaultObject);
        setItemMock.mockReset();

        ls.set(defaultObject);

        expect(setItemMock).not.toHaveBeenCalled();
      });
    });

    describe("get", () => {
      it("returns a cached fallback when storage reads are denied", () => {
        getItemMock.mockImplementationOnce(() => {
          throw new DOMException("Denied", "SecurityError");
        });
        const value = ls.get();
        expect(value).toEqual(defaultObject);
        value.fontSize = 999;
        expect(ls.get()).toEqual(defaultObject);
        expect(getItemMock).toHaveBeenCalledOnce();
      });

      it("handles a throwing localStorage getter", () => {
        const descriptor = Object.getOwnPropertyDescriptor(
          window,
          "localStorage",
        );
        if (descriptor === undefined) {
          throw new Error("Missing localStorage descriptor");
        }
        try {
          Object.defineProperty(window, "localStorage", {
            configurable: true,
            get: () => {
              throw new DOMException("Denied", "SecurityError");
            },
          });
          expect(ls.get()).toEqual(defaultObject);
        } finally {
          Object.defineProperty(window, "localStorage", descriptor);
        }
      });

      it("keeps the fallback when malformed-data repair cannot be persisted", () => {
        getItemMock.mockReturnValue("badjson");
        setItemMock.mockImplementationOnce(() => {
          throw new DOMException("Full", "QuotaExceededError");
        });
        expect(ls.get()).toEqual(defaultObject);
        expect(ls.get()).toEqual(defaultObject);
        expect(getItemMock).toHaveBeenCalledOnce();
      });

      it("keeps migrated settings when a repair write is denied", () => {
        getItemMock.mockReturnValue(JSON.stringify({ old: true }));
        setItemMock.mockImplementationOnce(() => {
          throw new DOMException("Denied", "SecurityError");
        });
        const migrated = { ...defaultObject, fontSize: 20 };
        const storage = new LocalStorageWithSchema({
          key: "config",
          schema: objectSchema,
          fallback: defaultObject,
          migrate: () => migrated,
        });
        expect(storage.get()).toEqual(migrated);
        expect(storage.get()).toEqual(migrated);
        expect(getItemMock).toHaveBeenCalledOnce();
      });

      it("retains validated writes in memory and retries persistence", () => {
        const changed = { ...defaultObject, fontSize: 24 };
        setItemMock.mockImplementationOnce(() => {
          throw new DOMException("Denied", "SecurityError");
        });
        expect(ls.set(changed)).toBe(false);
        expect(ls.get()).toEqual(changed);
        expect(ls.set(changed)).toBe(true);
        expect(setItemMock).toHaveBeenCalledTimes(2);
        expect(setItemMock).toHaveBeenLastCalledWith(
          "config",
          JSON.stringify(changed),
        );
      });

      it("should revert to the fallback value if localstorage is null", () => {
        getItemMock.mockReturnValue(null);

        const res = ls.get();

        expect(getItemMock).toHaveBeenCalledWith("config");
        expect(setItemMock).not.toHaveBeenCalled();
        expect(res).toEqual(defaultObject);

        //cache used
        expect(ls.get()).toEqual(res);
        expect(getItemMock).toHaveBeenCalledOnce();
      });

      it("should revert to the fallback value if localstorage json is malformed", () => {
        getItemMock.mockReturnValue("badjson");

        const res = ls.get();

        expect(getItemMock).toHaveBeenCalledWith("config");
        expect(setItemMock).toHaveBeenCalledWith(
          "config",
          JSON.stringify(defaultObject),
        );
        expect(res).toEqual(defaultObject);

        //cache used
        expect(ls.get()).toEqual(defaultObject);
        expect(getItemMock).toHaveBeenCalledOnce();
      });

      it("should get from localStorage", () => {
        getItemMock.mockReturnValue(JSON.stringify(defaultObject));

        const res = ls.get();

        expect(getItemMock).toHaveBeenCalledWith("config");
        expect(setItemMock).not.toHaveBeenCalled();
        expect(res).toEqual(defaultObject);

        //cache used
        expect(ls.get()).toEqual(res);
        expect(getItemMock).toHaveBeenCalledOnce();
      });

      it("should revert to fallback value if no migrate function and schema failed", () => {
        getItemMock.mockReturnValue(JSON.stringify({ hi: "hello" }));
        const ls = new LocalStorageWithSchema({
          key: "config",
          schema: objectSchema,
          fallback: defaultObject,
        });

        const res = ls.get();

        expect(getItemMock).toHaveBeenCalledWith("config");
        expect(setItemMock).toHaveBeenCalledWith(
          "config",
          JSON.stringify(defaultObject),
        );
        expect(res).toEqual(defaultObject);

        //cache used
        expect(ls.get()).toEqual(defaultObject);
        expect(getItemMock).toHaveBeenCalledOnce();
      });

      it("should migrate (when function is provided) if schema failed", () => {
        const existingValue = { hi: "hello" };

        getItemMock.mockReturnValue(JSON.stringify(existingValue));

        const migrated = {
          punctuation: false,
          mode: "time",
          fontSize: 1,
        };

        // oxlint-disable-next-line typescript/no-unsafe-return
        const migrateFnMock = vi.fn(() => migrated as any);

        const ls = new LocalStorageWithSchema({
          key: "config",
          schema: objectSchema,
          fallback: defaultObject,
          migrate: migrateFnMock,
        });

        const res = ls.get();

        expect(getItemMock).toHaveBeenCalledWith("config");
        expect(migrateFnMock).toHaveBeenCalledWith(
          existingValue,
          expect.any(Array),
        );
        expect(setItemMock).toHaveBeenCalledWith(
          "config",
          JSON.stringify(migrated),
        );
        expect(res).toEqual(migrated);

        //cache used
        expect(ls.get()).toEqual(migrated);
        expect(getItemMock).toHaveBeenCalledOnce();
      });

      it("should return a clone so mutating the result does not affect the cache", () => {
        getItemMock.mockReturnValue(JSON.stringify(defaultObject));

        const first = ls.get();
        first.fontSize = 999;
        first.mode = "time";

        const second = ls.get();
        expect(second).toEqual(defaultObject);
        // only one call to getItem — second get() used cache
        expect(getItemMock).toHaveBeenCalledOnce();
      });

      it("should return a clone of the fallback so mutating it does not affect the cache", () => {
        getItemMock.mockReturnValue(null);

        const first = ls.get();
        first.punctuation = false;
        first.fontSize = 0;

        const second = ls.get();
        expect(second).toEqual(defaultObject);
        expect(getItemMock).toHaveBeenCalledOnce();
      });

      it("should return a new object reference on each get() call", () => {
        getItemMock.mockReturnValue(JSON.stringify(defaultObject));

        const first = ls.get();
        const second = ls.get();

        expect(first).toEqual(second);
        expect(first).not.toBe(second);
      });

      it("should not skip set() after caller mutates a previously returned value", () => {
        ls.set(defaultObject);
        setItemMock.mockReset();

        // get a clone, mutate it, then set it back — should detect the change
        const value = ls.get();
        value.fontSize = 42;
        ls.set(value);

        expect(setItemMock).toHaveBeenCalledWith(
          "config",
          JSON.stringify({ ...defaultObject, fontSize: 42 }),
        );
      });

      it("should revert to fallback if migration ran but schema still failed", () => {
        const existingValue = { hi: "hello" };

        getItemMock.mockReturnValue(JSON.stringify(existingValue));

        const invalidMigrated = {
          punctuation: 1,
          mode: "time",
          fontSize: 1,
        };

        // oxlint-disable-next-line typescript/no-unsafe-return
        const migrateFnMock = vi.fn(() => invalidMigrated as any);

        const ls = new LocalStorageWithSchema({
          key: "config",
          schema: objectSchema,
          fallback: defaultObject,
          migrate: migrateFnMock,
        });

        const res = ls.get();

        expect(getItemMock).toHaveBeenCalledWith("config");
        expect(migrateFnMock).toHaveBeenCalledWith(
          existingValue,
          expect.any(Array),
        );
        expect(setItemMock).toHaveBeenCalledWith(
          "config",
          JSON.stringify(defaultObject),
        );
        expect(res).toEqual(defaultObject);

        //cache used
        expect(ls.get()).toEqual(defaultObject);
        expect(getItemMock).toHaveBeenCalledOnce();
      });
    });
  });
});
