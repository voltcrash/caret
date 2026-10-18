import {
  GithubProfileSchema,
  TwitterProfileSchema,
  UserProfileDetailsSchema,
  WebsiteSchema,
} from "@oxytype/schemas/users";
import { createForm } from "@tanstack/solid-form";
import { For } from "solid-js";

import { operation } from "../../../data/operations";
import { NO_BADGE_ID } from "../../controllers/badge-controller";
import { getSnapshot, setSnapshot } from "../../db";
import { invalidateMyProfile } from "../../queries/profile";
import { hideModal } from "../../states/modals";
import {
  showErrorNotification,
  showSuccessNotification,
} from "../../states/notifications";
import { cn } from "../../utils/cn";
import { AnimatedModal } from "../common/AnimatedModal";
import { Button } from "../common/Button";
import { UserBadge } from "../common/UserBadge";
import { Checkbox } from "../ui/form/Checkbox";
import { InputField } from "../ui/form/InputField";
import { SubmitButton } from "../ui/form/SubmitButton";
import { TextareaField } from "../ui/form/TextareaField";
import { fromSchema } from "../ui/form/utils";

export function EditProfile() {
  const snapshot = getSnapshot();
  if (snapshot === undefined) {
    throw new Error("missing snapshot in EditProfile");
  }
  const badges = snapshot.inventory?.badges ?? [];
  const form = createForm(() => ({
    defaultValues: {
      bio: snapshot.details?.bio ?? "",
      keyboard: snapshot.details?.keyboard ?? "",
      github: snapshot.details?.socialProfiles?.github ?? "",
      twitter: snapshot.details?.socialProfiles?.twitter ?? "",
      website: snapshot.details?.socialProfiles?.website ?? "",
      showActivityOnPublicProfile:
        snapshot.details?.showActivityOnPublicProfile ?? true,
      badgeId: badges.find((b) => b.selected)?.id,
    },
    onSubmit: async ({ value }) => {
      const updates = {
        bio: value.bio,
        keyboard: value.keyboard,
        socialProfiles: {
          twitter: value.twitter ?? "",
          github: value.github ?? "",
          website: value.website ?? "",
        },
        showActivityOnPublicProfile: value.showActivityOnPublicProfile,
      };

      const response = await operation("users.updateProfile", {
        body: {
          ...updates,
          selectedBadgeId: value.badgeId,
        },
      });

      if (!response.ok) {
        showErrorNotification("Failed to update profile", {
          operation: response,
        });
        return;
      }

      const current = getSnapshot();
      if (current === undefined) return;
      const newBadges =
        current.inventory?.badges?.map((it) => ({
          ...it,
          selected: it.id === value.badgeId,
        })) ?? [];

      form.reset(value);
      hideModal("EditProfile");
      setSnapshot({
        ...current,
        details: response.data ?? updates,
        inventory: { ...current.inventory, badges: newBadges },
      });
      void invalidateMyProfile();
      showSuccessNotification("Profile updated");
    },
  }));

  return (
    <AnimatedModal
      id="EditProfile"
      title="Edit Profile"
      modalClass="max-w-[600px]"
    >
      <form
        class="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
      >
        <div>
          <div class="mb-[0.25em] block text-text">name</div>
          <div>
            To update your name, go to Account Settings &gt; Account &gt; Update
            account name
          </div>
        </div>

        <div>
          <label for="bio" class="mb-[0.25em] block text-text">
            bio
          </label>
          <form.Field
            name="bio"
            validators={{
              onChange: fromSchema(UserProfileDetailsSchema.shape.bio),
            }}
          >
            {(field) => (
              <>
                <TextareaField field={field} maxLength={250} />
                <div class="mt-1 text-base">
                  {field().state.value.length}/250
                </div>
              </>
            )}
          </form.Field>
        </div>

        <div>
          <label for="keyboard" class="mb-[0.25em] block text-text">
            keyboard
          </label>
          <form.Field
            name="keyboard"
            validators={{
              onChange: fromSchema(UserProfileDetailsSchema.shape.keyboard),
            }}
          >
            {(field) => (
              <>
                <TextareaField field={field} maxLength={75} />
                <div class="mt-1 text-base">
                  {field().state.value.length}/75
                </div>
              </>
            )}
          </form.Field>
        </div>

        <div>
          <label for="github" class="mb-[0.25em] block text-text">
            github
          </label>
          <div class="flex flex-wrap items-center sm:flex-nowrap">
            <p class="my-2 mr-2 min-w-0 [overflow-wrap:anywhere]">
              https://github.com/
            </p>
            <div class="w-full sm:max-w-60">
              <form.Field
                name="github"
                validators={{
                  onChange: fromSchema(GithubProfileSchema),
                }}
              >
                {(field) => (
                  <InputField
                    field={field}
                    class="github"
                    type="text"
                    maxLength={39}
                  />
                )}
              </form.Field>
            </div>
          </div>
        </div>

        <div>
          <label for="twitter" class="mb-[0.25em] block text-text">
            twitter
          </label>
          <div class="flex flex-wrap items-center sm:flex-nowrap">
            <p class="my-2 mr-2 min-w-0 [overflow-wrap:anywhere]">
              https://x.com/
            </p>
            <div class="w-full sm:max-w-60">
              <form.Field
                name="twitter"
                validators={{
                  onChange: fromSchema(TwitterProfileSchema),
                }}
              >
                {(field) => (
                  <InputField
                    field={field}
                    class="twitter"
                    type="text"
                    maxLength={15}
                  />
                )}
              </form.Field>
            </div>
          </div>
        </div>

        <div>
          <label for="website" class="mb-[0.25em] block text-text">
            website
          </label>
          <form.Field
            name="website"
            validators={{
              onChange: fromSchema(WebsiteSchema),
            }}
          >
            {(field) => (
              <InputField
                field={field}
                class="website"
                type="text"
                maxLength={200}
              />
            )}
          </form.Field>
        </div>

        <div>
          <div class="mb-[0.25em] block text-text">badge</div>
          <form.Field name="badgeId">
            {(field) => (
              <div class="flex flex-wrap gap-2">
                <For each={[{ id: undefined }, ...badges]}>
                  {(badge) => (
                    <Button
                      class={cn(
                        "p-0 opacity-25 max-sm:min-h-9 max-sm:min-w-9 hover:opacity-100",
                        {
                          "opacity-100": field().state.value === badge.id,
                        },
                      )}
                      active={field().state.value === badge.id}
                      onClick={() => field().handleChange(badge.id)}
                    >
                      <UserBadge
                        id={badge.id ?? NO_BADGE_ID}
                        class="p-1.5 text-em-sm"
                        hideDescription
                      />
                    </Button>
                  )}
                </For>
              </div>
            )}
          </form.Field>
        </div>

        <div>
          <div class="mb-[0.25em] block text-text">public activity</div>
          <form.Field name="showActivityOnPublicProfile">
            {(field) => (
              <Checkbox
                field={field}
                label="Include test activity graph on your public profile."
              />
            )}
          </form.Field>
        </div>

        <SubmitButton form={form} class="w-full">
          save
        </SubmitButton>
      </form>
    </AnimatedModal>
  );
}
