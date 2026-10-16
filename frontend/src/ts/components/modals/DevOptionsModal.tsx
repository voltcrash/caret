import { UserNameSchema } from "@oxytype/schemas/users";
import { createSignal, For, JSXElement } from "solid-js";
import { z } from "zod";

import { toggleCaretDebug } from "../../../features/typing/components/words/caret-controller";
import { toggleUserFakeChartData } from "../../../features/typing/runtime/result";
import { disableSlowTimerFail } from "../../../features/typing/runtime/test-timer";
import Ape from "../../ape";
import { refetchInboxCollection } from "../../collections/inbox";
import { addXp } from "../../db";
import { getInputElement } from "../../input/input-element";
import { hideModal, showModal } from "../../states/modals";
import {
  showErrorNotification,
  showNoticeNotification,
  showSuccessNotification,
} from "../../states/notifications";
import { showSimpleModal } from "../../states/simple-modal";
import { FaSolidIcon } from "../../types/font-awesome";
import { setMediaQueryDebugLevel } from "../../ui";
import { isProfilerMode, setProfilerMode } from "../../utils/profiler-mode";
import { remoteValidation } from "../../utils/remote-validation";
import { AnimatedModal } from "../common/AnimatedModal";
import { Button } from "../common/Button";

const [mediaQueryDebugLevel, setLocalMediaQueryDebugLevel] = createSignal(0);

type DevButton = {
  icon: FaSolidIcon;
  label: () => string;
  onClick: () => void;
};

export function DevOptionsModal(): JSXElement {
  const buttons: DevButton[] = [
    {
      icon: "fa-database",
      label: () => "Generate Data",
      onClick: () => showGenerateDataModal(),
    },
    {
      icon: "fa-bell",
      label: () => "Test Notifications",
      onClick: () => {
        showSuccessNotification("This is a test", { durationMs: 0 });
        showNoticeNotification("This is a test", { durationMs: 0 });
        showErrorNotification("This is a test", {
          durationMs: 0,
          details: { test: true, error: "Example error message" },
        });
        showNoticeNotification(["Structured lines", "test"], {
          durationMs: 0,
        });
        hideModal("DevOptions");
      },
    },
    {
      icon: "fa-ruler",
      label: () => `Media Query Debug (${mediaQueryDebugLevel()})`,
      onClick: () => {
        const next =
          mediaQueryDebugLevel() >= 2 ? 0 : mediaQueryDebugLevel() + 1;
        setLocalMediaQueryDebugLevel(next);
        showNoticeNotification(`Setting media query debug level to ${next}`);
        setMediaQueryDebugLevel(next);
      },
    },
    {
      icon: "fa-eye",
      label: () => "Show Real Words Input",
      onClick: () => {
        const el = getInputElement();
        el.style.opacity = "1";
        el.style.marginTop = "1.5em";
        el.style.caretColor = "red";
        hideModal("DevOptions");
      },
    },
    {
      icon: "fa-star",
      label: () => "XP Simple Test",
      onClick: () => {
        setTimeout(() => {
          addXp(1000);
        }, 500);
        hideModal("DevOptions");
      },
    },
    {
      icon: "fa-star",
      label: () => "XP with breakdown Test",
      onClick: () => {
        setTimeout(() => {
          const fakeBreakdown = {
            base: 100,
            quote: 10,
            corrected: 5,
            funbox: 5,
            streak: 10,
            incomplete: 10,
            accPenalty: 5,
            configMultiplier: 2,
            daily: 10000,
          };
          const totalFakeXp = 10270;
          addXp(totalFakeXp, fakeBreakdown);
        }, 500);
        hideModal("DevOptions");
      },
    },
    {
      icon: "fa-inbox",
      label: () => "Add Debug Inbox Item",
      onClick: () => {
        showModal("DevInboxPicker");
      },
    },
    {
      icon: "fa-chart-bar",
      label: () => "Toggle Fake Chart Data",
      onClick: toggleUserFakeChartData,
    },
    {
      icon: "fa-i-cursor",
      label: () => "Toggle Caret Debug",
      onClick: toggleCaretDebug,
    },
    {
      icon: "fa-clock",
      label: () => "Disable Slow Timer Fail",
      onClick: disableSlowTimerFail,
    },
    {
      icon: "fa-vials",
      label: () => "Event Log Viewer",
      onClick: () => showModal("EventLogViewer"),
    },
    {
      icon: "fa-stopwatch",
      label: () => `Profiler Mode (${isProfilerMode() ? "ON" : "OFF"})`,
      onClick: () => {
        setProfilerMode(!isProfilerMode());
        showNoticeNotification("Profiler mode toggled, reloading...");
        setTimeout(() => location.reload(), 500);
      },
    },
  ];

  const addDebugInboxItem = (rewardType: "xp" | "badge" | "none"): void => {
    hideModal("DevInboxPicker");
    void Ape.dev
      .addDebugInboxItem({ body: { rewardType } })
      .then((response) => {
        if (response.status !== 200) {
          showErrorNotification("Failed to add inbox item", {
            details: response.body,
          });
          return;
        }
        showSuccessNotification("Debug inbox item added");
        void refetchInboxCollection();
      });
  };

  return (
    <>
      <AnimatedModal id="DevOptions" title="Dev Options">
        <div class="flex flex-col gap-4">
          <For each={buttons}>
            {(btn) => (
              <Button
                variant="button"
                onClick={btn.onClick}
                fa={{ icon: btn.icon, fixedWidth: true }}
                text={btn.label()}
              />
            )}
          </For>
        </div>
      </AnimatedModal>
      <AnimatedModal id="DevInboxPicker" title="Choose Reward Type">
        <div class="flex flex-col gap-4">
          <Button
            variant="button"
            onClick={() => addDebugInboxItem("xp")}
            fa={{ icon: "fa-star", fixedWidth: true }}
            text="XP Reward (1000)"
          />
          <Button
            variant="button"
            onClick={() => addDebugInboxItem("badge")}
            fa={{ icon: "fa-certificate", fixedWidth: true }}
            text="Badge Reward"
          />
          <Button
            variant="button"
            onClick={() => addDebugInboxItem("none")}
            fa={{ icon: "fa-envelope", fixedWidth: true }}
            text="No Reward"
          />
        </div>
      </AnimatedModal>
    </>
  );
}

function showGenerateDataModal(): void {
  showSimpleModal({
    title: "Generate data",
    text: "Generate test results for an existing account.",
    class: "max-w-2xl",
    schema: z.object({
      username: UserNameSchema,
      firstTestTimestamp: z.date().max(new Date()).optional(),
      lastTestTimestamp: z.date().max(new Date()).optional(),
      minTestsPerDay: z.number().int().min(0).max(200),
      maxTestsPerDay: z.number().int().min(0).max(200),
    }),
    inputs: {
      username: {
        type: "text",
        label: "username",
        placeholder: "username",
        validation: {
          isValid: remoteValidation(
            async (name: string) =>
              Ape.users.getNameAvailability({ params: { name } }),
            { check: (data) => !data.available || "Unknown user" },
          ),
          debounceDelay: 1000,
        },
      },
      firstTestTimestamp: {
        type: "date",
        label: "first test",
      },
      lastTestTimestamp: {
        type: "date",
        label: "last test",
      },
      minTestsPerDay: {
        type: "range",
        label: "min tests per day",
        initVal: 0,
        step: 10,
      },
      maxTestsPerDay: {
        type: "range",
        label: "max tests per day",
        initVal: 50,

        step: 10,
      },
    },
    buttonText: "generate (might take a while)",
    execFn: async ({
      username,
      firstTestTimestamp,
      lastTestTimestamp,
      minTestsPerDay,
      maxTestsPerDay,
    }) => {
      const result = await Ape.dev.generateData({
        body: {
          username,
          firstTestTimestamp: firstTestTimestamp?.getTime(),
          lastTestTimestamp: lastTestTimestamp?.getTime(),
          minTestsPerDay,
          maxTestsPerDay,
        },
      });

      return {
        status: result.status === 200 ? "success" : "error",
        message: result.body.message,
      };
    },
  });
}
