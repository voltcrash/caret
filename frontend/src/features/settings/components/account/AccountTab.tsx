import { Fa } from "#shared/components/common/Fa.tsx";
import { showUpdateNameModal } from "#shared/components/modals/account-settings/UpdateNameModal.tsx";
import { showModal } from "#shared/states/modals.ts";
import { getSnapshot } from "#shared/states/snapshot.ts";

import {
  showOptOutOfLeaderboardsModal,
  showResetPersonalBestsModal,
} from "./ReauthConfirmModals";
import { Section } from "./utils";

export function AccountTab() {
  return (
    <>
      <UpdateAccountName />
      <UpdateStreakOffset />
      <OptOutLeaderboard />
      <ResetPersonalBests />
    </>
  );
}

function UpdateAccountName() {
  return (
    <Section
      key="accountName"
      title="update account name"
      fa={{ icon: "fa-user" }}
      description=<>
        Change the name of your account.{" "}
        <span class="text-error">You can only do this once every 30 days.</span>
      </>
      button={{
        text: "update name",
        onClick: () => showUpdateNameModal(),
      }}
    />
  );
}

function UpdateStreakOffset() {
  return (
    <Section
      key="streakHourOffset"
      title="set streak hour offset"
      fa={{ icon: "fa-clock" }}
      description=<>
        Streaks reset at midnight UTC by default. If this is not convenient for
        you (for example if it means that streaks reset in the middle of the
        day), you can change the hour offset here.{" "}
        <span class="text-error">You can only do this once!</span>
      </>
      button={{
        text: "update hour offset",
        onClick: () => showModal("StreakHourOffset"),
      }}
      disabled={getSnapshot()?.streakHourOffset !== undefined}
      disabledDescription=<>
        <Fa icon="fa-exclamation-triangle" /> You have already set your streak
        hour offset to{" "}
        {`${(getSnapshot()?.streakHourOffset ?? 0) > 0 ? "+" : ""} ${getSnapshot()?.streakHourOffset}`}
        .
      </>
    />
  );
}

function OptOutLeaderboard() {
  return (
    <Section
      key="lbOptOut"
      title="opt out of leaderboards"
      fa={{ icon: "fa-crown" }}
      description=<>
        Use this if you frequently trigger the anticheat (for example if using
        stenography) to opt out of leaderboards.{" "}
        <span class="text-error">You can&apos;t undo this action!</span>
      </>
      button={{
        text: "opt out",
        onClick: () => showOptOutOfLeaderboardsModal(),
      }}
      disabled={getSnapshot()?.lbOptOut === true}
      disabledDescription=<>
        <Fa icon="fa-exclamation-triangle" />
        You have opted out of leaderboards.
      </>
    />
  );
}

function ResetPersonalBests() {
  return (
    <Section
      key="resetPersonalBests"
      title="reset personal bests"
      fa={{ icon: "fa-crown" }}
      description=<>
        Resets all your personal bests (but doesn&apos;t delete any tests from
        your history). <span class="text-error">You can&apos;t undo this!</span>
      </>
      button={{
        text: "reset personal bests",
        onClick: () => showResetPersonalBestsModal(),
      }}
    />
  );
}
