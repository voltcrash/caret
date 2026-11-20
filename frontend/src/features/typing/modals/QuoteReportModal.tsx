import { QuoteReportReason } from "@caret/schemas/quotes";
import { createForm } from "@tanstack/solid-form";
import { JSXElement, createSignal } from "solid-js";

import { operation } from "../../../data/operations";
import { AnimatedModal } from "../../../ts/components/common/AnimatedModal";
import { Separator } from "../../../ts/components/common/Separator";
import { Captcha } from "../../../ts/components/ui/form/Captcha";
import { LabeledField } from "../../../ts/components/ui/form/LabeledField";
import { SubmitButton } from "../../../ts/components/ui/form/SubmitButton";
import { TextareaField } from "../../../ts/components/ui/form/TextareaField";
import {
  allFieldsMandatory,
  fieldMandatory,
} from "../../../ts/components/ui/form/utils";
import Select from "../../../ts/components/ui/Select";
import { getMutableConfig } from "../../../ts/config/store";
import { hideLoaderBar, showLoaderBar } from "../../../ts/states/loader-bar";
import { hideModalAndClearChain } from "../../../ts/states/modals";
import {
  showErrorNotification,
  showNoticeNotification,
  showSuccessNotification,
} from "../../../ts/states/notifications";
import { removeLanguageSize } from "../../../ts/utils/strings";
import QuotesController from "../runtime/quotes-controller";
import { quoteId } from "../state/quote-report";

export function QuoteReportModal(): JSXElement {
  const [quoteText, setQuoteText] = createSignal("");

  const form = createForm(() => ({
    defaultValues: {
      reason: "Grammatical error" as QuoteReportReason,
      comment: "",
      captcha: "",
    },
    onSubmit: async ({ value }) => {
      const id = quoteId().toString();
      const quoteLanguage = removeLanguageSize(getMutableConfig().language);

      if (value.captcha === "") {
        showNoticeNotification("Please complete the captcha");
        return;
      }

      if (id === "" || id === "0") {
        showNoticeNotification("Please select a quote");
        return;
      }

      const characterDifference = value.comment.length - 250;
      if (characterDifference > 0) {
        showNoticeNotification(
          `Report comment is ${characterDifference} character(s) too long`,
        );
        return;
      }

      showLoaderBar();
      const response = await operation("quotes.report", {
        body: {
          quoteId: id,
          quoteLanguage,
          reason: value.reason,
          comment: value.comment,
          captcha: value.captcha,
        },
      }).finally(() => {
        form.setFieldValue("captcha", "");
        hideLoaderBar();
      });

      if (!response.ok) {
        showErrorNotification("Failed to report quote", {
          operation: response,
        });
        return;
      }

      showSuccessNotification("Report submitted. Thank you!");
      hideModalAndClearChain("QuoteReport");
    },
    onSubmitInvalid: () => {
      showNoticeNotification("Please fill in all fields");
    },
    validators: {
      onChange: allFieldsMandatory(),
    },
  }));

  const handleBeforeShow = async (): Promise<void> => {
    form.update({
      ...form.options,
      defaultValues: {
        reason: "Grammatical error" as QuoteReportReason,
        comment: "",
        captcha: "",
      },
    });
    form.reset();

    const language =
      getMutableConfig().language === "swiss_german"
        ? "german"
        : getMutableConfig().language;
    const { quotes } = await QuotesController.getQuotes(language);
    const quote = quotes.find((q) => q.id === quoteId());
    setQuoteText(quote?.text ?? "");
  };

  return (
    <AnimatedModal
      modalClass="w-full max-w-[750px]"
      id="QuoteReport"
      mode="dialog"
      title="Report a quote"
      beforeShow={handleBeforeShow}
    >
      <form
        class="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
      >
        Please report quotes responsibly - misuse may result in you losing
        access to this feature.
        <br />
        <span class="text-error">Please add comments in English only.</span>
        <Separator />
        <LabeledField label="quote">
          <div class="text-xl text-text" dir="auto">
            {quoteText()}
          </div>
        </LabeledField>
        <form.Field
          name="reason"
          children={(field) => (
            <LabeledField label="reason">
              <Select
                label="Report reason"
                options={[
                  { value: "Grammatical error", text: "Grammatical error" },
                  { value: "Duplicate quote", text: "Duplicate quote" },
                  {
                    value: "Inappropriate content",
                    text: "Inappropriate content",
                  },
                  {
                    value: "Low quality content",
                    text: "Low quality content",
                  },
                  { value: "Incorrect source", text: "Incorrect source" },
                ]}
                selected={field().state.value}
                onChange={(val) =>
                  field().handleChange(
                    (val ?? "Grammatical error") as QuoteReportReason,
                  )
                }
                settings={{ showSearch: false }}
              />
            </LabeledField>
          )}
        />
        <form.Field
          name="comment"
          validators={{ onChange: fieldMandatory<string>() }}
          children={(field) => (
            <LabeledField label="comment">
              <div class="relative">
                <TextareaField
                  field={field}
                  class="bg-bg-secondary min-h-50 w-full rounded p-2 text-text"
                  autocomplete="off"
                />
                <div
                  class={`absolute right-2 bottom-2 text-xs ${250 - field().state.value.length < 0 ? "text-error" : "text-sub"}`}
                >
                  {250 - field().state.value.length}
                </div>
              </div>
            </LabeledField>
          )}
        />
        <form.Field
          name="captcha"
          children={(field) => <Captcha field={field} action="quote-report" />}
        />
        <SubmitButton form={form} text="report" />
      </form>
    </AnimatedModal>
  );
}
