import { JSXElement } from "solid-js";

import { applyPendingInboxActions } from "../../../collections/inbox";
import { hideModalAndClearChain } from "../../../states/modals";
import { AnimatedModal } from "../../common/AnimatedModal";
import { Button } from "../../common/Button";
import { Inbox } from "./Inbox";
import { NotificationHistory } from "./NotificationHistory";
import { Psas } from "./Psas";

export function AlertsPopup(): JSXElement {
  return (
    <AnimatedModal
      id="Alerts"
      mobileSheet={false}
      modalClass="h-dvh absolute right-0 top-0 w-full sm:max-w-[calc(350px+2rem)] rounded-none sm:rounded-l bg-bg p-4 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-4 sm:pt-8 flex flex-col overflow-hidden"
      customAnimations={{
        show: {
          modal: {
            marginRight: ["-10rem", "0"],
          },
        },
        hide: {
          modal: {
            marginRight: ["0", "-10rem"],
          },
        },
      }}
      onEscape={() => hideModalAndClearChain("Alerts")}
      onBackdropClick={() => hideModalAndClearChain("Alerts")}
      afterHide={() => {
        setTimeout(() => {
          applyPendingInboxActions();
        }, 125);
      }}
    >
      <MobileClose />
      <div class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] content-baseline gap-8 overflow-y-scroll overscroll-contain px-4 text-xs">
        <Inbox />
        <Separator />
        <Psas />
        <Separator />
        <NotificationHistory />
      </div>
    </AnimatedModal>
  );
}

function MobileClose(): JSXElement {
  return (
    <Button
      class="mb-8 hidden w-full shrink-0 pointer-coarse:flex"
      onClick={() => hideModalAndClearChain("Alerts")}
      text="Close"
      fa={{ icon: "fa-times" }}
    />
  );
}

function Separator(): JSXElement {
  return <div class="h-1 rounded bg-sub-alt"></div>;
}
