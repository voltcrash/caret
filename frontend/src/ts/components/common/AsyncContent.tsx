import { typedKeys } from "@caret/util/objects";
import { UseQueryResult } from "@tanstack/solid-query";
import {
  untrack,
  Accessor,
  createEffect,
  createMemo,
  ErrorBoundary,
  JSXElement,
  Match,
  Show,
  Switch,
} from "solid-js";

import { showErrorNotification } from "../../states/notifications";
import { createErrorMessage } from "../../utils/error";
import { LoadingCircle } from "./LoadingCircle";

type AsyncEntry<T> = {
  value: () => T | undefined;
  isLoading: () => boolean;
  isError: () => boolean;
  error?: () => unknown;
};

type Collection<T> = Accessor<T> & {
  isLoading: boolean;
  isError: boolean;
};

type AsyncMap<T extends Record<string, unknown>> = {
  [K in keyof T]: AsyncEntry<T[K]>;
};

type BaseProps = {
  errorMessage?: string;
  ignoreError?: true;
  loader?: JSXElement;
  errorClass?: string;
};

type QueryProps<T extends Record<string, unknown>> = {
  queries: { [K in keyof T]: UseQueryResult<T[K]> };
};

type CollectionProps<T extends Record<string, unknown>> = {
  collections: { [K in keyof T]: Collection<T[K]> };
};

type AccessorMap<T> = { [K in keyof T]: Accessor<T[K]> };
type DataKeys<T> = { [K in keyof T as `${K & string}Data`]: T[K] };

type Source<T extends Record<string, unknown>> =
  | QueryProps<T>
  | CollectionProps<T>;

type DeferredChildren<T extends Record<string, unknown>> = {
  alwaysShowContent?: false;
  children: (
    data: AccessorMap<DataKeys<{ [K in keyof T]: T[K] }>>,
  ) => JSXElement;
};

type EagerChildren<T extends Record<string, unknown>> = {
  alwaysShowContent: true;
  showLoader?: true;
  children: (
    data: AccessorMap<DataKeys<{ [K in keyof T]: T[K] | undefined }>>,
  ) => JSXElement;
};

type Children<T extends Record<string, unknown>> =
  | DeferredChildren<T>
  | EagerChildren<T>;

export type Props<T extends Record<string, unknown>> = BaseProps &
  Source<T> &
  Children<T>;

function AsyncContent<T extends Record<string, unknown>>(
  props: Props<T>,
): JSXElement {
  const source = createMemo<AsyncMap<T>>(() => {
    if ("queries" in props) {
      return fromQueries(props.queries);
    } else {
      return fromCollections(props.collections);
    }
  });

  const value = (): T =>
    Object.fromEntries(
      typedKeys(source()).map((key) => [key, source()[key].value()]),
    ) as T;

  const handleError = (err: unknown): string => {
    const message = createErrorMessage(
      err,
      props.errorMessage ?? "An error occurred",
    );
    console.error("AsyncMultiContent failed", message, err);

    showErrorNotification(props.errorMessage ?? "An error occurred", {
      error: err,
    });

    return message;
  };

  const allResolved = (
    data: ReturnType<typeof value>,
  ): data is { [K in keyof T]: T[K] } => {
    if (data === undefined || data === null) {
      return false;
    }
    return Object.values(data).every((v) => v !== undefined && v !== null);
  };

  const isLoading = (): boolean =>
    Object.values(source() as AsyncEntry<unknown>[]).some((s) => s.isLoading());

  const firstError = (): unknown | undefined =>
    Object.values(source() as AsyncEntry<unknown>[])
      .find((s) => s.isError())
      ?.error?.();

  // Keep the last resolved value so deferred children stay mounted during
  // transient loading states (e.g. navigating away and back).
  const lastResolvedValue = createMemo<T | undefined>((prev) => {
    const current = value();
    return allResolved(current) ? current : prev;
  });

  const hasResolved = createMemo<boolean>(
    (prev) => prev || lastResolvedValue() !== undefined,
    false,
  );

  // Keys are stable for the component lifetime; per-key closures track
  // reactivity internally via value()/lastResolvedValue().
  const keys = untrack(() => typedKeys(source()));
  if (import.meta.env.DEV) {
    createEffect(() => {
      const currentKeys = typedKeys(source());
      if (
        currentKeys.length !== keys.length ||
        currentKeys.some((k, i) => k !== keys[i])
      ) {
        console.warn(
          "AsyncContent: query keys changed between renders. This is not supported.",
        );
      }
    });
  }
  const eagerAccessorMap = dataAccessors(
    keys,
    untrack(() => value),
  );
  const deferredAccessorMap = dataAccessors(
    keys,
    untrack(() => lastResolvedValue),
  );
  if (
    !hasDataAccessors<{ [K in keyof T]: T[K] | undefined }>(
      eagerAccessorMap,
      keys,
    ) ||
    !hasDataAccessors<{ [K in keyof T]: T[K] }>(deferredAccessorMap, keys)
  ) {
    throw new Error("AsyncContent: missing data accessors");
  }

  const loader = (): JSXElement =>
    props.loader ?? <LoadingCircle class="p-4 text-center text-2xl" />;

  const errorText = (err: unknown): JSXElement | undefined =>
    props.ignoreError ? undefined : (
      <div class={props.errorClass}>{handleError(err)}</div>
    );

  // Show loader on initial load or when the query key changed (no cached data)
  const showLoader = (): boolean =>
    isLoading() && !props.alwaysShowContent && !allResolved(value());

  return (
    <ErrorBoundary fallback={props.ignoreError ? undefined : errorText}>
      <Switch
        fallback={
          <>
            <Show when={showLoader()}>{loader()}</Show>
            <Show
              when={props.alwaysShowContent === true}
              fallback={
                <Show when={hasResolved()}>
                  {(_) =>
                    (props as DeferredChildren<T>).children(deferredAccessorMap)
                  }
                </Show>
              }
            >
              {(props as EagerChildren<T>).children(eagerAccessorMap)}
            </Show>
          </>
        }
      >
        <Match when={!props.ignoreError && firstError() !== undefined}>
          {errorText(firstError())}
        </Match>

        <Match when={showLoader()}>{loader()}</Match>
      </Switch>
    </ErrorBoundary>
  );
}

function fromQueries<T extends Record<string, unknown>>(queries: {
  [K in keyof T]: UseQueryResult<T[K]>;
}): AsyncMap<T> {
  return typedKeys(queries).reduce((acc, key) => {
    const q = queries[key];
    acc[key] = {
      value: () => q.data,
      isLoading: () => q.isLoading,
      isError: () => q.isError,
      error: () => q.error,
    };
    return acc;
  }, {} as AsyncMap<T>);
}

function fromCollections<T extends Record<string, unknown>>(collections: {
  [K in keyof T]: Collection<T[K]>;
}): AsyncMap<T> {
  return typedKeys(collections).reduce((acc, key) => {
    const q = collections[key];
    acc[key] = {
      value: () => q(),
      isLoading: () => q.isLoading,
      isError: () => q.isError,
    };
    return acc;
  }, {} as AsyncMap<T>);
}

export default AsyncContent;

function keyAccessor<T, K extends keyof T>(
  getData: Accessor<T | undefined>,
  key: K,
): Accessor<T[K] | undefined> {
  return () => getData()?.[key];
}

/** One `${key}Data` accessor per key, reading through `getData`. */
function dataAccessors<T>(
  keys: (keyof T)[],
  getData: Accessor<T | undefined>,
): Record<string, Accessor<unknown>> {
  return Object.fromEntries(
    keys.map((key) => [`${String(key)}Data`, keyAccessor(getData, key)]),
  );
}

function hasDataAccessors<V>(
  map: Record<string, Accessor<unknown>>,
  keys: (keyof V)[],
): map is AccessorMap<DataKeys<V>> {
  return keys.every((key) => typeof map[`${String(key)}Data`] === "function");
}
