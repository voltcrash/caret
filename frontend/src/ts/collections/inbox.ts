import { createAccountOwned } from "../../app/account-scope";
import { createAccountSignal } from "../../app/state";
import { onCleanup, Accessor } from "solid-js";
import { AllRewards, MonkeyMail } from "@oxytype/schemas/users";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import {
  createCollection,
  createPacedMutations,
  eq,
  MutationFnParams,
  not,
  useLiveQuery,
} from "@tanstack/solid-db";
import Ape from "../ape";
import { getQueryClient } from "../queries";
import { defineCollection } from "./utils/scope";
import { baseKey } from "../queries/utils/keys";
import { isAuthenticated } from "../states/core";
import { flushDebounceStrategy } from "./utils/flushDebounceStrategy";
import {
  showErrorNotification,
  showSuccessNotification,
} from "../states/notifications";
import * as BadgeController from "../controllers/badge-controller";
import { addBadge, addXp } from "../db";

const getFlushStrategy = createAccountOwned(() => {
  const value = flushDebounceStrategy({ maxWait: 1000 * 60 * 5 });
  onCleanup(() => value.strategy.cleanup());
  return value;
});
export function applyPendingInboxActions(): void {
  getFlushStrategy().flush();
}

const queryKeys = {
  root: () => [...baseKey("inbox", { isUserSpecific: true })],
};

const [maxMailboxSize, setMaxMailboxSize] = createAccountSignal(0);

export { maxMailboxSize };
export type InboxItem = Omit<MonkeyMail, "read"> & {
  status: "unclaimed" | "unread" | "read" | "deleted";
};
const inboxCollection = defineCollection(import.meta.hot, () =>
  createCollection(
    queryCollectionOptions({
      staleTime: 1000 * 60 * 5,
      queryKey: queryKeys.root(),
      enabled: isAuthenticated,
      queryFn: async () => {
        const addStatus = (item: MonkeyMail): InboxItem => ({
          ...item,
          status:
            item.rewards.length > 0 && !item.read
              ? "unclaimed"
              : item.read
                ? "read"
                : "unread",
        });

        const response = await Ape.users.getInbox();
        if (response.status !== 200) {
          showErrorNotification(
            `Error fetching user inbox: ${response.body.message}`,
          );
          throw new Error(
            `Error fetching user inbox: ${response.body.message}`,
          );
        }
        setMaxMailboxSize(response.body.data.maxMail);
        return response.body.data.inbox.map(addStatus);
      },
      queryClient: getQueryClient(),
      getKey: (it) => it.id,
    }),
  ),
);

export async function refetchInboxCollection(): Promise<void> {
  await inboxCollection().utils.refetch();
}

const getPendingIds = createAccountOwned(() => [] as string[]);
const mutation = createAccountOwned(() =>
  createPacedMutations<Pick<InboxItem, "id" | "status">, InboxItem>({
    onMutate: ({ id, status }) => {
      inboxCollection().update(id, (old) => {
        if (old.status === "unclaimed") {
          getPendingIds().push(old.id);
        }
        old.status = status;
      });
    },
    mutationFn: async (changes) => {
      await flushPendingChanges(changes);

      const allRewards: AllRewards[] = changes.transaction.mutations
        .map((it) => it.modified)
        .filter((it) => getPendingIds().includes(it.id))
        .flatMap((it) => it.rewards);
      getPendingIds().length = 0;
      claimRewards(allRewards);
    },
    strategy: getFlushStrategy().strategy,
  }),
);
export function mutateInboxItem(
  params: Pick<InboxItem, "id" | "status">,
): ReturnType<ReturnType<typeof mutation>> {
  return mutation()(params);
}

function claimRewards(pendingRewards: AllRewards[]): void {
  if (pendingRewards.length === 0) return;

  let totalXp = 0;
  const badgeNames: string[] = [];
  for (const reward of pendingRewards) {
    if (reward.type === "xp" && (reward.client ?? "web") === "web") {
      totalXp += reward.item;
    } else if (reward.type === "badge") {
      const badge = BadgeController.getById(reward.item.id);
      if (badge) {
        badgeNames.push(badge.name);
        addBadge(reward.item);
      }
    }
  }
  if (totalXp > 0) {
    addXp(totalXp);
  }

  if (badgeNames.length > 0) {
    showSuccessNotification(
      `New badge${badgeNames.length > 1 ? "s" : ""} unlocked: ${badgeNames.join(", ")}`,
      { durationMs: 5000, customTitle: "Reward", customIcon: "gift" },
    );
  }
}

export function claimAllInboxItems(): void {
  inboxCollection().forEach((it) => {
    if (it.status === "unclaimed") {
      mutateInboxItem({ id: it.id, status: "read" });
    }
  });
}

export function deleteAllInboxItems(): void {
  inboxCollection().forEach((it) => {
    if (it.status === "unread" || it.status === "read") {
      mutateInboxItem({ id: it.id, status: "deleted" });
    }
  });
}

async function flushPendingChanges({
  transaction,
}: MutationFnParams<InboxItem>): Promise<unknown> {
  const updatedStatus = Object.groupBy(
    transaction.mutations.map((it) => it.modified),
    (it) => it.status,
  );

  const response = await Ape.users.updateInbox({
    body: {
      mailIdsToMarkRead: updatedStatus.read?.map((it) => it.id),
      mailIdsToDelete: updatedStatus.deleted?.map((it) => it.id),
    },
  });

  if (response.status !== 200) {
    showErrorNotification(
      `Error updating user inbox: ${response.body.message}`,
    );
    throw new Error(`Error updating user inbox: ${response.body.message}`);
  }

  inboxCollection().utils.writeBatch(() => {
    updatedStatus.deleted?.forEach((deleted) =>
      inboxCollection().utils.writeDelete(deleted.id),
    );
    updatedStatus.read?.forEach((read) => {
      inboxCollection().utils.writeUpdate(read);
    });
  });

  return { refetch: false };
}

export function useInboxQuery(enabled: Accessor<boolean>) {
  return useLiveQuery((q) => {
    if (!isAuthenticated() || !enabled()) return undefined;
    return q
      .from({ inbox: inboxCollection() })
      .where(({ inbox }) => not(eq(inbox.status, "deleted")))
      .orderBy(({ inbox }) => inbox.timestamp, "desc")
      .orderBy(({ inbox }) => inbox.subject, "asc");
  });
}
