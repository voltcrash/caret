import { CompletedEvent } from "@oxytype/schemas/results";
import objectHash from "object-hash";
import { createMemo, JSX } from "solid-js";

import type { SavedResult } from "../../constants/default-snapshot";

import { operation } from "../../../data/operations";
import { getAuthenticatedUser } from "../../auth-client";
import { getConfig } from "../../config/store";
import { saveLocalResult, SaveLocalResultData } from "../../db";
import { hideModal } from "../../states/modals";
import {
  showErrorNotification,
  showNoticeNotification,
  showSuccessNotification,
} from "../../states/notifications";
import {
  getLastSignedOutResult,
  setLastSignedOutResult,
} from "../../states/test";
import { cn } from "../../utils/cn";
import { Formatting } from "../../utils/format";
import { AnimatedModal } from "../common/AnimatedModal";
import { Button } from "../common/Button";
import { Separator } from "../common/Separator";

const modalId = "LastSignedOutResult";

export function LastSignedOutResultModal() {
  const format = createMemo(
    () =>
      new Formatting({
        alwaysShowDecimalPlaces: getConfig.alwaysShowDecimalPlaces,
        typingSpeedUnit: getConfig.typingSpeedUnit,
      }),
  );

  const handleDiscard = () => {
    showNoticeNotification("Last test result discarded");
    hideModal(modalId);
    setTimeout(() => {
      setLastSignedOutResult(null);
    }, 125);
  };

  const handleSave = () => {
    void syncLastSignedOutResult();
  };

  return (
    <AnimatedModal
      id={modalId}
      title="Last signed out result"
      modalClass="max-w-2xl"
    >
      <p class="">Would you like to save it?</p>
      <Separator />

      <div class="grid grid-cols-2 gap-2">
        <Value
          class="text-2xl"
          label={format().typingSpeedUnit}
          value={format().typingSpeed(getLastSignedOutResult()?.wpm ?? 0)}
        />
        <Value
          class="text-2xl"
          label="accuracy"
          value={format().accuracy(getLastSignedOutResult()?.acc ?? 0)}
        />
        <Value
          label="raw"
          value={format().typingSpeed(getLastSignedOutResult()?.rawWpm ?? 0)}
        />
        <Value
          label="consistency"
          value={format().percentage(
            getLastSignedOutResult()?.consistency ?? 0,
          )}
        />
        <Value
          class="col-span-2"
          label="characters"
          value={getLastSignedOutResult()?.charStats.join("/") ?? "-"}
        />
        <Value
          label="test type"
          class="col-span-2"
          value={formatTestType(getLastSignedOutResult())}
        />
      </div>
      {/*
      need two sets of buttons here because on wide screens tab focuses save first
      but on small screens tab focuses discard first
      */}
      <div class="grid grid-cols-1 gap-2 sm:hidden">
        <Button text="save" onClick={handleSave} />
        <Button text="discard" onClick={handleDiscard} />
      </div>
      <div class="hidden grid-cols-2 gap-2 sm:grid">
        <Button text="discard" onClick={handleDiscard} />
        <Button text="save" onClick={handleSave} />
      </div>
    </AnimatedModal>
  );
}

function Value(props: {
  label: string;
  value: string | (string | JSX.Element)[];
  class?: string;
}) {
  return (
    <div
      class={cn(
        "flex min-w-0 flex-col text-sm [overflow-wrap:anywhere]",
        props.class,
      )}
    >
      <span class="text-em-xs text-sub">{props.label}</span>
      <span>{props.value}</span>
    </div>
  );
}

function formatTestType(r: CompletedEvent | null): (string | JSX.Element)[] {
  if (r === null) return ["-"];
  const tt: (string | JSX.Element)[] = [`${r.mode} ${r.mode2}`];

  tt.push(<br />, `${r.language}`);

  if (r.numbers) tt.push(<br />, "numbers");
  if (r.punctuation) tt.push(<br />, "punctuation");
  if (r.blindMode) tt.push(<br />, "blind");
  if (r.lazyMode) tt.push(<br />, "lazy");
  if (r.funbox.length > 0) {
    const funboxLabel = r.funbox.map((it) => it.replace(/_/g, " ")).join(",");
    tt.push(<br />, funboxLabel);
  }
  if (r.difficulty !== "normal") tt.push(<br />, `${r.difficulty}`);
  if (r.tags.length > 0) tt.push(<br />, `${r.tags.length} tags`);
  return tt;
}

async function syncLastSignedOutResult(): Promise<void> {
  const user = getAuthenticatedUser();
  const lastResult = getLastSignedOutResult();
  if (user === null) {
    showNoticeNotification(
      "Failed to save last test result: user not authenticated",
    );
    hideModal(modalId);
    return;
  }
  if (lastResult === null) {
    showNoticeNotification("Failed to save last test result: no last result");
    hideModal(modalId);
    return;
  }

  const updatedResult = updateUidAndHash(user.uid, lastResult);
  const response = await operation("results.add", {
    body: { result: updatedResult },
  });

  if (!response.ok) {
    showErrorNotification(`Failed to save last result`, {
      operation: response,
    });
    hideModal(modalId);
    return;
  }

  const result: SavedResult = Object.assign(structuredClone(updatedResult), {
    _id: response.data.insertedId,
  });

  const dataToSave: SaveLocalResultData = {
    xp: response.data.xp,
    streak: response.data.streak,
    result,
    isPb: response.data.isPb,
  };

  if (response.data.isPb) {
    result.isPb = true;
  }
  saveLocalResult(dataToSave);
  setLastSignedOutResult(null);
  showSuccessNotification(
    `Last test result saved ${response.data.isPb ? `(new pb!)` : ""}`,
  );
  hideModal(modalId);
}

export function updateUidAndHash(
  uid: string,
  notSignedInLastResult: CompletedEvent,
): CompletedEvent {
  notSignedInLastResult.uid = uid;
  const unhashed: Omit<CompletedEvent, "hash"> & { hash?: string } =
    notSignedInLastResult;
  delete unhashed.hash;
  notSignedInLastResult.hash = objectHash(notSignedInLastResult);
  return notSignedInLastResult;
}
