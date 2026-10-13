import {
  CompletedEventSchema,
  type CompletedEvent,
} from "@oxytype/schemas/results";
import { hashResult } from "@oxytype/typing-core/result-hash";
import {
  createContext,
  createSignal,
  useContext,
  type Accessor,
} from "solid-js";

import type { Api, ApiResponse } from "../api/client";
import type { UploadIdentity } from "../auth/identity";
import { ApiError, responseError, TransportError } from "../api/client";
import { errorMessage } from "../auth/store";
import type { FinishedTest, LocalResult } from "../test/typing-test";
import type { QueueEntry, UploadQueue } from "./upload-queue";

type UploadStatus = {
  result: LocalResult;
  state: "uploading" | "uploaded" | "queued" | "error";
  message: string;
  isPb?: boolean;
};
export type ResultUploader = {
  last: Accessor<UploadStatus | undefined>;
  notice: Accessor<string | undefined>;
  accept: (test: FinishedTest) => Promise<void>;
  drain: () => Promise<void>;
  flush: () => Promise<void>;
};

/** Final identity/client/offline fields must be present before hashing. */
export async function uploadPayload(
  result: LocalResult,
  uid: string,
  offline: boolean,
): Promise<CompletedEvent> {
  const payload = { ...result, uid, client: "tui" as const, offline };
  return CompletedEventSchema.parse({
    ...payload,
    hash: await hashResult(payload),
  });
}

export function createResultUploader(options: {
  api: Api;
  queue: UploadQueue;
  identity: () => UploadIdentity | undefined;
}): ResultUploader {
  const { api, queue, identity } = options;
  const [last, setLast] = createSignal<UploadStatus>();
  const [notice, setNotice] = createSignal<string>();
  let lastEntryId: string | undefined;
  let pending = Promise.resolve();
  async function serialize(operation: () => Promise<void>): Promise<void> {
    pending = pending.then(operation, operation);
    return pending;
  }
  function status(
    id: string,
    state: UploadStatus["state"],
    message: string,
    isPb?: boolean,
  ): void {
    const result = last()?.result;
    if (id === lastEntryId && result !== undefined) {
      setLast({ result, state, message, isPb });
    }
  }
  function canUpload(entry: QueueEntry): boolean {
    const current = identity();
    return (
      current?.online === true &&
      current.uid === entry.result.uid &&
      current.apiUrl === entry.apiUrl
    );
  }
  async function send(
    entry: QueueEntry,
    payload = entry.result,
  ): Promise<boolean> {
    if (!canUpload(entry)) return false;
    status(entry.id, "uploading", "uploading…");
    try {
      const response = await api.client.results.add({
        body: { result: payload },
      });
      const raw: ApiResponse = response;
      const duplicate = raw.status === 466;
      if (response.status === 200 || duplicate) {
        await queue.remove(entry.id);
        const pb = response.status === 200 && response.body.data.isPb;
        status(
          entry.id,
          "uploaded",
          payload.offline === true
            ? "uploaded · offline history/stats only"
            : duplicate
              ? "already submitted"
              : "uploaded",
          pb,
        );
        setNotice(undefined);
        return true;
      }
      throw responseError(response);
    } catch (error) {
      const retry =
        error instanceof TransportError ||
        (error instanceof ApiError &&
          (error.retryable || error.status === 401));
      const message = retry
        ? "queued · upload on reconnect (history/stats only)"
        : `upload rejected: ${errorMessage(error)}`;
      if (!retry) await queue.reject(entry.id, errorMessage(error));
      status(entry.id, retry ? "queued" : "error", message);
      setNotice(retry ? errorMessage(error) : message);
      return !retry;
    }
  }
  return {
    last,
    notice,
    accept: async (test) =>
      serialize(async () => {
        if (test.invalid !== undefined || test.owner === undefined) return;
        try {
          const payload = await uploadPayload(
            test.result,
            test.owner.uid,
            true,
          );
          const entry = await queue.add(test.owner.apiUrl, payload);
          lastEntryId = entry.id;
          setLast({
            result: test.result,
            state: "queued",
            message: "queued · offline history/stats only",
          });
          if (test.owner.online && canUpload(entry)) {
            await send(
              entry,
              await uploadPayload(test.result, test.owner.uid, false),
            );
          }
        } catch (error) {
          setLast({
            result: test.result,
            state: "error",
            message: `Could not queue upload: ${errorMessage(error)}`,
          });
        }
      }),
    drain: async () =>
      serialize(async () => {
        try {
          await queue.flush();
          const lastPending = queue
            .entries()
            .some((entry) => entry.id === lastEntryId);
          await queue.expire();
          if (
            lastPending &&
            !queue.entries().some((entry) => entry.id === lastEntryId)
          ) {
            status(
              lastEntryId ?? "",
              "error",
              "upload expired after 30 days; local history retained",
            );
          }
          for (const entry of queue.entries()) {
            if (entry.state !== "pending" || !canUpload(entry)) continue;
            if (!(await send(entry))) break;
          }
        } catch (error) {
          setNotice(errorMessage(error));
        }
      }),
    flush: async () => pending,
  };
}
export const UploadContext = createContext<ResultUploader>();
export function useUploads(): ResultUploader | undefined {
  return useContext(UploadContext);
}
