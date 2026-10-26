import { createSignal, JSXElement, onCleanup, Show } from "solid-js";

import { applyConfigFromJson } from "../../config/lifecycle";
import { useRef } from "../../hooks/useRef";
import { hideModalAndClearChain } from "../../states/modals";
import { cn } from "../../utils/cn";
import { isObject } from "../../utils/misc";
import { AnimatedModal } from "../common/AnimatedModal";
import { Button } from "../common/Button";
import { Fa } from "../common/Fa";

function parseSettingsJson(json: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid JSON. Check the text and try again.");
  }
  if (!isObject(parsed)) {
    throw new Error("Settings JSON must be an object.");
  }
  return parsed;
}

export function ImportSettingsModal(): JSXElement {
  const [json, setJson] = createSignal("");
  const [filename, setFilename] = createSignal<string>();
  const [error, setError] = createSignal<string>();
  const [isReading, setIsReading] = createSignal(false);
  const [isImporting, setIsImporting] = createSignal(false);
  const [isDragging, setIsDragging] = createSignal(false);
  const [fileRef, fileInput] = useRef<HTMLInputElement>();
  const [editorRef, editor] = useRef<HTMLTextAreaElement>();
  let fileRequest = 0;
  let dragDepth = 0;
  const isBusy = (): boolean => isReading() || isImporting();

  onCleanup(() => fileRequest++);

  const loadFile = async (file: File): Promise<void> => {
    if (isBusy()) return;
    const request = ++fileRequest;
    setIsReading(true);
    setFilename(file.name);
    setError(undefined);
    try {
      const text = (await file.text()).replace(/^\uFEFF/, "");
      if (request !== fileRequest) return;
      setJson(text);
      try {
        setJson(JSON.stringify(parseSettingsJson(text), null, 2));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Invalid settings JSON.");
      }
    } catch {
      if (request === fileRequest) {
        setError("Couldn't read this file. Choose it again or paste the JSON.");
      }
    } finally {
      if (request === fileRequest) setIsReading(false);
    }
  };

  const importSettings = async (): Promise<void> => {
    if (isBusy() || json().trim() === "") return;
    setError(undefined);
    try {
      parseSettingsJson(json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid settings JSON.");
      return;
    }
    setIsImporting(true);
    try {
      if (await applyConfigFromJson(json())) {
        hideModalAndClearChain("ImportSettings");
      } else {
        setError(
          "Couldn't import these settings. Check the JSON and try again.",
        );
      }
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <AnimatedModal
      id="ImportSettings"
      title="import settings"
      modalClass="max-w-2xl"
      wrapperClass="p-4 sm:p-8"
      beforeShow={() => {
        fileRequest++;
        dragDepth = 0;
        setJson("");
        setFilename(undefined);
        setError(undefined);
        setIsReading(false);
        setIsImporting(false);
        setIsDragging(false);
      }}
      beforeHide={() => {
        fileRequest++;
        dragDepth = 0;
        setIsDragging(false);
      }}
      afterShow={() => editor()?.focus()}
    >
      <form
        class="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void importSettings();
        }}
      >
        <p class="text-sm text-sub">
          Choose a settings file or paste your JSON below. Review it before
          importing.
        </p>
        <div
          role="region"
          aria-label="JSON file upload"
          class={cn(
            "grid justify-items-center gap-3 rounded-double border-2 border-dashed p-6 text-center transition-colors duration-125",
            isDragging()
              ? "border-main bg-main/10"
              : "border-sub bg-sub-alt/50",
          )}
          onDragEnter={(event) => {
            event.preventDefault();
            if (isBusy()) return;
            dragDepth++;
            setIsDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            dragDepth = Math.max(0, dragDepth - 1);
            if (dragDepth === 0) setIsDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            dragDepth = 0;
            setIsDragging(false);
            if (isBusy()) return;
            const files = event.dataTransfer?.files;
            if (!files || files.length === 0) return;
            if (files.length !== 1) {
              setError("Choose one JSON file at a time.");
              return;
            }
            const file = files[0];
            if (file) void loadFile(file);
          }}
        >
          <Fa icon="fa-file-code" class="text-2xl text-main" />
          <div>
            {isDragging()
              ? "Release to load your file"
              : "Drop your JSON file here"}
          </div>
          <Button
            disabled={isBusy()}
            fa={{ icon: "fa-folder-open" }}
            onClick={() => fileInput()?.click()}
          >
            {isReading() ? "reading file..." : "choose file"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            aria-label="Choose settings JSON file"
            class="hidden"
            disabled={isBusy()}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void loadFile(file);
            }}
          />
          <Show when={filename()}>
            {(name) => (
              <div class="max-w-full text-xs break-all text-sub">{name()}</div>
            )}
          </Show>
        </div>
        <div class="flex items-center gap-3 text-xs text-sub">
          <div class="h-px grow bg-sub-alt"></div>
          or paste JSON
          <div class="h-px grow bg-sub-alt"></div>
        </div>
        <div class="grid gap-2">
          <textarea
            ref={editorRef}
            id="importSettingsJson"
            name="json"
            aria-label="settings JSON"
            class="h-40 min-h-32 w-full resize-y rounded border-none bg-sub-alt p-3 text-sm leading-relaxed caret-main outline-none focus-visible:shadow-text-focus sm:h-48"
            placeholder={'{\n  "theme": "azure",\n  "time": 30\n}'}
            spellcheck={false}
            value={json()}
            disabled={isBusy()}
            aria-invalid={error() !== undefined}
            aria-describedby={
              error() !== undefined ? "importSettingsError" : undefined
            }
            onInput={(event) => {
              setJson(event.currentTarget.value);
              setFilename(undefined);
              setError(undefined);
            }}
          ></textarea>
        </div>
        <Show when={error()}>
          {(message) => (
            <p id="importSettingsError" role="alert" class="text-sm text-error">
              {message()}
            </p>
          )}
        </Show>
        <p class="text-xs text-sub">
          Unsupported settings are removed automatically.
        </p>
        <div class="grid grid-cols-2 gap-2">
          <Button onClick={() => hideModalAndClearChain("ImportSettings")}>
            cancel
          </Button>
          <Button type="submit" disabled={isBusy() || json().trim() === ""}>
            {isImporting() ? "importing..." : "import settings"}
          </Button>
        </div>
      </form>
    </AnimatedModal>
  );
}
