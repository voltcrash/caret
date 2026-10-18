import { UserNameWithoutFilterSchema } from "@oxytype/schemas/users";
import { createForm } from "@tanstack/solid-form";
import { useQueryClient } from "@tanstack/solid-query";
import { useNavigate } from "@tanstack/solid-router";
import { createSignal, type JSXElement, onMount } from "solid-js";

import { profileOptions } from "../../data/profile";
import { H2 } from "../../ts/components/common/Headers";
import { InputField } from "../../ts/components/ui/form/InputField";
import { SubmitButton } from "../../ts/components/ui/form/SubmitButton";
import { fromSchema } from "../../ts/components/ui/form/utils";
import { useRef } from "../../ts/hooks/useRef";
import { showNoticeNotification } from "../../ts/states/notifications";

/** `/profile` lookup; a fresh form per visit, focused on entry. */
export function ProfileSearch(): JSXElement {
  const [isEditable, setEditable] = createSignal(true);
  const [inputRef, inputEl] = useRef<HTMLElement>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const form = createForm(() => ({
    defaultValues: { username: "" },
    onSubmit: async ({ value }) => {
      setEditable(false);
      try {
        await navigate({
          to: "/profile/$uidOrName",
          params: { uidOrName: value.username },
        });
      } finally {
        setEditable(true);
      }
    },
    onSubmitInvalid: () => {
      showNoticeNotification("Please fill in all fields");
    },
  }));

  onMount(() => {
    requestAnimationFrame(() => {
      inputEl()
        ?.querySelector<HTMLInputElement>("input")
        ?.focus({ preventScroll: true });
    });
  });

  return (
    <div class="grid min-h-full place-items-center">
      <form
        class="inline-grid w-full max-w-[24rem] gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <div class="text-center">
          <H2 class="text-2xl" text="Profile lookup" />
        </div>

        <div class="flex w-full gap-2 text-xl">
          <div class="flex-1 text-center" ref={inputRef}>
            <form.Field
              name="username"
              validators={{
                onChange: fromSchema(UserNameWithoutFilterSchema),
                onChangeAsyncDebounceMs: 1000,
                onChangeAsync: async (field) => {
                  try {
                    await queryClient.query(profileOptions(field.value, "web"));
                    return undefined;
                  } catch {
                    return "Unknown user";
                  }
                },
              }}
              children={(field) => (
                <InputField
                  field={field}
                  placeholder="username"
                  autocomplete="new-username"
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={!isEditable()}
                />
              )}
            />
          </div>
          <div class="text-center">
            <SubmitButton
              form={form}
              class="shrink"
              fa={{ icon: "fa-chevron-right" }}
              disabled={!isEditable()}
            />
          </div>
        </div>
      </form>
    </div>
  );
}
