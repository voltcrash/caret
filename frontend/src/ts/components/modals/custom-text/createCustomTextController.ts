import { CustomTextIncomingData, Mode } from "./types";
import { createForm } from "@tanstack/solid-form";
import { batch, createSignal, untrack } from "solid-js";
import { setConfig } from "../../../config/setters";
import { getMutableConfig } from "../../../config/store";
import { restartTestEvent } from "../../../events/test";
import {
  getCustomTextIndicator,
  setCustomTextIndicator,
} from "../../../states/core";
import { hideModalAndClearChain } from "../../../states/modals";
import {
  showNoticeNotification,
  showErrorNotification,
} from "../../../states/notifications";
import { getLoadedChallenge, setLoadedChallenge } from "../../../states/test";
import * as CustomText from "../../../test/custom-text";
import * as PractiseWords from "../../../test/practise-words";
import { getBailOutHint } from "../../../utils/bail-out";
import * as Strings from "../../../utils/strings";
import {
  cleanCustomText,
  replaceCustomTextNewlines,
  convertCustomTextDelimiter,
} from "./text";

export function createCustomTextController() {
  const [longTextWarning, setLongTextWarning] = createSignal(false);
  const [challengeWarning, setChallengeWarning] = createSignal(false);

  const [incomingChainedData, setIncomingChainedData] =
    createSignal<CustomTextIncomingData>(null);

  const [textToSave, setTextToSave] = createSignal<string[]>([]);

  let fileInputRef!: HTMLInputElement;
  let textareaRef: HTMLTextAreaElement | undefined;

  const form = createForm(() => ({
    defaultValues: {
      text: "",
      mode: "simple" as Mode,
      limitWord: "",
      limitTime: "",
      limitSection: "",
      pipeDelimiter: false,
    },
    onSubmit: ({ value }) => {
      if (value.text === "") {
        showNoticeNotification("Text cannot be empty");
        return;
      }

      const activeLimits = [
        value.limitWord,
        value.limitTime,
        value.limitSection,
      ].filter((l) => l !== "");
      if (activeLimits.length > 1) {
        showNoticeNotification("You can only specify one limit", {
          durationMs: 5000,
        });
        return;
      }

      if (
        value.mode !== "simple" &&
        value.limitWord === "" &&
        value.limitTime === "" &&
        value.limitSection === ""
      ) {
        showNoticeNotification("You need to specify a limit", {
          durationMs: 5000,
        });
        return;
      }

      if (
        value.limitSection === "0" ||
        value.limitWord === "0" ||
        value.limitTime === "0"
      ) {
        showNoticeNotification(`Infinite test! ${getBailOutHint()}`, {
          durationMs: 7000,
        });
      }

      const text = cleanUpText();
      if (text.length === 0) {
        showNoticeNotification("Text cannot be empty");
        return;
      }

      if (value.mode === "simple") {
        CustomText.setMode("repeat");
      } else {
        CustomText.setMode(value.mode);
      }

      CustomText.setPipeDelimiter(value.pipeDelimiter);
      CustomText.setText(text);

      if (value.mode === "simple" && value.pipeDelimiter) {
        CustomText.setLimitMode("section");
        CustomText.setLimitValue(text.length);
      } else if (value.mode === "simple") {
        CustomText.setLimitMode("word");
        CustomText.setLimitValue(text.length);
      } else if (value.limitWord !== "") {
        CustomText.setLimitMode("word");
        CustomText.setLimitValue(parseInt(value.limitWord));
      } else if (value.limitTime !== "") {
        CustomText.setLimitMode("time");
        CustomText.setLimitValue(parseInt(value.limitTime));
      } else if (value.limitSection !== "") {
        CustomText.setLimitMode("section");
        CustomText.setLimitValue(parseInt(value.limitSection));
      }

      if (getLoadedChallenge() !== null) {
        showNoticeNotification("Challenge cleared");
        setLoadedChallenge(null);
      }
      if (getMutableConfig().mode !== "custom") {
        setConfig("mode", "custom");
      }
      PractiseWords.resetBefore();
      restartTestEvent.dispatch();
      hideModalAndClearChain("CustomText");
    },
  }));

  const formValues = form.useSelector((s) => s.values);

  const isDisabled = (): boolean => longTextWarning() || challengeWarning();
  const isLimitDisabled = (): boolean =>
    formValues().mode === "simple" || isDisabled();

  const showWordLimit = (): boolean => !formValues().pipeDelimiter;
  const showSectionLimit = (): boolean => formValues().pipeDelimiter;

  const cleanUpText = (): string[] => {
    return cleanCustomText(
      form.getFieldValue("text"),
      form.getFieldValue("pipeDelimiter"),
    );
  };

  const applyRemoveZeroWidth = (): void => {
    form.setFieldValue(
      "text",
      form.getFieldValue("text").replace(/[\u200B-\u200D\u2060\uFEFF]/g, ""),
    );
  };

  const applyRemoveFancyTypography = (): void => {
    form.setFieldValue(
      "text",
      Strings.cleanTypographySymbols(form.getFieldValue("text")),
    );
  };

  const applyReplaceControlChars = (): void => {
    form.setFieldValue(
      "text",
      Strings.replaceControlCharacters(form.getFieldValue("text")),
    );
  };

  const applyReplaceNewlines = (mode: "space" | "periodSpace"): void => {
    form.setFieldValue(
      "text",
      replaceCustomTextNewlines(form.getFieldValue("text"), mode),
    );
  };

  const handleDelimiterChange = (newPipeDelimiter: boolean): void => {
    const currentPipeDelimiter = form.getFieldValue("pipeDelimiter");
    const newtext = convertCustomTextDelimiter(
      form.getFieldValue("text"),
      currentPipeDelimiter,
      newPipeDelimiter,
    );

    batch(() => {
      form.setFieldValue("text", newtext);
      form.setFieldValue("pipeDelimiter", newPipeDelimiter);
      if (newPipeDelimiter && form.getFieldValue("limitWord") !== "") {
        form.setFieldValue("limitWord", "");
      }
      if (!newPipeDelimiter && form.getFieldValue("limitSection") !== "") {
        form.setFieldValue("limitSection", "");
      }
    });
  };

  const initState = (): void => {
    let mode: Mode = CustomText.getMode();
    if (
      mode === "repeat" &&
      CustomText.getLimitMode() !== "time" &&
      CustomText.getLimitValue() === CustomText.getText().length
    ) {
      mode = "simple";
    }

    const pipeDelimiter = CustomText.getPipeDelimiter();
    let limitWord = "";
    let limitTime = "";
    let limitSection = "";

    if (mode !== "simple") {
      if (CustomText.getLimitMode() === "word") {
        limitWord = `${CustomText.getLimitValue()}`;
      } else if (CustomText.getLimitMode() === "time") {
        limitTime = `${CustomText.getLimitValue()}`;
      } else if (CustomText.getLimitMode() === "section") {
        limitSection = `${CustomText.getLimitValue()}`;
      }
    }

    const text = CustomText.getText()
      .join(pipeDelimiter ? "|" : " ")
      .replace(/^ +/gm, "");

    untrack(() => {
      batch(() => {
        form.setFieldValue("mode", mode);
        form.setFieldValue("limitWord", limitWord);
        form.setFieldValue("limitTime", limitTime);
        form.setFieldValue("limitSection", limitSection);
        form.setFieldValue("pipeDelimiter", pipeDelimiter);
        form.setFieldValue("text", text);
      });
    });

    setLongTextWarning(getCustomTextIndicator()?.isLong ?? false);
    setChallengeWarning(getLoadedChallenge() !== null);
  };

  const handleIncomingData = (): void => {
    const data = incomingChainedData();
    if (data === null) return;
    setIncomingChainedData(null);

    if (data.long !== true && getCustomTextIndicator()?.isLong) {
      setCustomTextIndicator(undefined);
      showNoticeNotification("Disabled long custom text progress tracking", {
        durationMs: 5000,
      });
      setLongTextWarning(false);
    }

    if (data.long) {
      setLongTextWarning(true);
    }

    const incomingText =
      data.splitText !== undefined
        ? data.splitText.join(form.getFieldValue("pipeDelimiter") ? "|" : " ")
        : data.text;

    const newText =
      (data.set ?? true)
        ? incomingText
        : `${form.getFieldValue("text")} ${incomingText}`;
    untrack(() => {
      batch(() => {
        form.setFieldValue("text", newText);
        form.setFieldValue("mode", "simple");
        form.setFieldValue("limitWord", `${cleanUpText().length}`);
        form.setFieldValue("limitTime", "");
        form.setFieldValue("limitSection", "");
      });
    });
  };

  const handleFileOpen = (): void => {
    const file = fileInputRef?.files?.[0];
    if (!file) return;

    if (file.type !== "text/plain") {
      showErrorNotification("File is not a text file", { durationMs: 5000 });
      return;
    }

    const reader = new FileReader();
    reader.readAsText(file, "UTF-8");
    reader.onload = (e) => {
      const content = e.target?.result as string;
      form.setFieldValue("text", content);
      fileInputRef.value = "";
    };
    reader.onerror = () => {
      showErrorNotification("Failed to read file", { durationMs: 5000 });
    };
  };

  const handleTextareaKeydown = (e: KeyboardEvent): void => {
    if (e.key === "Tab") {
      e.preventDefault();
      const area = e.currentTarget as HTMLTextAreaElement;
      const start = area.selectionStart;
      const end = area.selectionEnd;
      area.value = `${area.value.substring(0, start)}\t${area.value.substring(end)}`;
      area.selectionStart = area.selectionEnd = start + 1;
      form.setFieldValue("text", area.value);
    }
  };

  const handleTextareaKeypress = (e: KeyboardEvent): void => {
    if (isDisabled()) {
      e.preventDefault();
      return;
    }
    if (e.code === "Enter" && e.ctrlKey) {
      void form.handleSubmit();
    }
    if (getCustomTextIndicator()?.isLong) {
      setCustomTextIndicator(undefined);
      setLongTextWarning(false);
      showNoticeNotification("Disabled long custom text progress tracking", {
        durationMs: 5000,
      });
    }
  };

  const handleModeChange = (value: string): void => {
    batch(() => {
      const previousMode = formValues().mode;

      form.setFieldValue("mode", value as Mode);
      if (value === "simple") {
        form.setFieldValue("limitWord", "");
        form.setFieldValue("limitTime", "");
        form.setFieldValue("limitSection", "");
      } else if (previousMode === "simple") {
        const text = cleanUpText();
        form.setFieldValue("limitTime", "");
        if (form.getFieldValue("pipeDelimiter")) {
          form.setFieldValue("limitSection", `${text.length}`);
        } else {
          form.setFieldValue("limitWord", `${text.length}`);
        }
      }
    });
  };

  const beforeShow = (isChained: boolean): void => {
    if (!isChained) {
      initState();
    } else {
      handleIncomingData();
    }
  };

  const afterShow = (): void => {
    if (!isDisabled()) {
      textareaRef?.focus();
    }
  };

  return {
    longTextWarning,
    setLongTextWarning,
    challengeWarning,
    setChallengeWarning,
    setIncomingChainedData,
    textToSave,
    setTextToSave,
    form,
    formValues,
    isDisabled,
    isLimitDisabled,
    showWordLimit,
    showSectionLimit,
    cleanUpText,
    applyRemoveZeroWidth,
    applyRemoveFancyTypography,
    applyReplaceControlChars,
    applyReplaceNewlines,
    handleDelimiterChange,
    handleFileOpen,
    handleTextareaKeydown,
    handleTextareaKeypress,
    handleModeChange,
    beforeShow,
    afterShow,
    fileInputRef: (element: HTMLInputElement): void => {
      fileInputRef = element;
    },
    textareaRef: (element: HTMLTextAreaElement): void => {
      textareaRef = element;
    },
    openFile: (): void => {
      fileInputRef.click();
    },
  };
}

export type CustomTextController = ReturnType<
  typeof createCustomTextController
>;
