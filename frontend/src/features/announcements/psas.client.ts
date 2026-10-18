import { PSA } from "@oxytype/schemas/psas";
import { IdSchema } from "@oxytype/schemas/util";
import { isSafeNumber } from "@oxytype/util/numbers";
import { format } from "date-fns/format";
import { envConfig } from "virtual:env-config";
import { z } from "zod";

import { OperationError } from "../../data/operation-result";
import { operationData } from "../../data/operations";
import { getQueryClient } from "../../ts/queries";
import { addBanner } from "../../ts/states/banners";
import { setPsas, type AlertPsa } from "../../ts/states/psas";
import { secondsToString } from "../../ts/utils/date-and-time";
import { isDevEnvironment } from "../../ts/utils/env";
import { LocalStorageWithSchema } from "../../ts/utils/local-storage-with-schema";

const confirmedPSAs = new LocalStorageWithSchema({
  key: "confirmedPSAs",
  schema: z.array(IdSchema),
  fallback: [],
});

function clearMemory(): void {
  confirmedPSAs.set([]);
}

function getMemory(): string[] {
  return confirmedPSAs.get();
}

function setMemory(id: string): void {
  const list = getMemory();
  list.push(id);
  confirmedPSAs.set(list);
}

async function getLatest(): Promise<PSA[] | null> {
  // No server announcements exist in frontend-only development.
  if (envConfig.devOffline) return null;
  try {
    return await getQueryClient().query({
      queryKey: ["psas"],
      queryFn: async () => await operationData("psas.get"),
      staleTime: 0,
      retry: false,
    });
  } catch (error) {
    const status = error instanceof OperationError ? error.status : 500;
    if (status === 500) {
      addBanner(
        isDevEnvironment()
          ? {
              level: "notice",
              text: "Dev Info: Backend server not running",
              icon: "fas fa-exclamation-triangle",
            }
          : {
              level: "error",
              text: "The Oxytype server is currently unavailable.",
              icon: "fas fa-exclamation-triangle",
            },
      );
    } else if (status === 503) {
      addBanner({
        level: "error",
        icon: "fas fa-bullhorn",
        text: "The Oxytype server is currently under maintenance.",
      });
    }
    return null;
  }
}

/**
 * Fetches announcements, lists them in alerts and banners unconfirmed ones.
 * `bannered` holds IDs already shown by this runtime, so refetching after an
 * account change never stacks a second banner.
 */
export async function showPsas(bannered: Set<string>): Promise<void> {
  const latest = await getLatest();
  if (latest === null) return;
  if (latest.length === 0) {
    setPsas([]);
    clearMemory();
    return;
  }
  const localmemory = getMemory();
  const alerts: AlertPsa[] = [];
  latest.forEach((item) => {
    const psa = { ...item };
    if (isSafeNumber(psa.date)) {
      const dateObj = new Date(psa.date);
      const diff = psa.date - Date.now();
      const string = secondsToString(
        diff / 1000,
        false,
        false,
        "text",
        false,
        true,
      );
      psa.message = psa.message.replace("{dateDifference}", string);
      psa.message = psa.message.replace(
        "{dateNoTime}",
        format(dateObj, "dd MMM yyyy"),
      );
      psa.message = psa.message.replace(
        "{date}",
        format(dateObj, "dd MMM yyyy HH:mm"),
      );
    }

    alerts.push({ message: psa.message, level: psa.level ?? -1 });

    if (localmemory.includes(psa._id) && !(psa.sticky ?? false)) {
      return;
    }
    if (bannered.has(psa._id)) return;
    bannered.add(psa._id);

    let level: "error" | "notice" | "success";
    if (psa.level === -1) {
      level = "error";
    } else if (psa.level === 1) {
      level = "success";
    } else {
      level = "notice";
    }

    addBanner({
      level,
      text: psa.message,
      icon: "fas fa-bullhorn",
      important: psa.sticky ?? false,
      onClose: () => {
        setMemory(psa._id);
      },
    });
  });
  setPsas(alerts);
}
