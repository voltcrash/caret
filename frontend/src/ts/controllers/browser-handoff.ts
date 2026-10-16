import { operation } from "../../data/operations";
import {
  parseBrowserHandoff,
  type BrowserHandoff,
} from "@oxytype/schemas/browser-handoff";
import { setConfig } from "../config/setters";
import { navigate } from "../navigation/navigation";
import { showModal } from "../states/modals";
import {
  showErrorNotification,
  showNoticeNotification,
} from "../states/notifications";
import { showQuoteReportModal } from "../states/quote-report";
import { setUserToReport } from "../states/user-report";

let pending: BrowserHandoff | undefined;
let read = false;

/** Keep the requested form through login; only open it, never submit it. */
export async function loadBrowserHandoff(
  search: string,
  signedIn: boolean,
): Promise<void> {
  if (!read) {
    read = true;
    try {
      pending = parseBrowserHandoff(search);
    } catch {
      showErrorNotification("Invalid terminal browser link");
    }
  }
  if (pending === undefined) return;
  if (!signedIn) {
    showNoticeNotification("Sign in to continue the terminal browser action");
    await navigate("/login").catch((error: unknown) =>
      showErrorNotification("Could not open login", { error }),
    );
    return;
  }
  const handoff = pending;
  pending = undefined;
  try {
    if (handoff.action === "user-report") {
      const response = await operation("users.getProfile", {
        params: { uidOrName: handoff.username },
        query: { isUid: false, client: "web" },
      });
      if (!response.ok) {
        showErrorNotification(
          `Could not load the reported user (${response.status})`,
        );
        return;
      }
      setUserToReport(response.data);
      showModal("UserReport");
    } else {
      setConfig("language", handoff.language, { nosave: true });
      if (handoff.action === "quote-report") {
        showQuoteReportModal(handoff.quoteId);
      } else {
        showModal("QuoteSubmit");
      }
    }
  } catch (error) {
    showErrorNotification("Could not open the terminal browser action", {
      error,
    });
  }
}
