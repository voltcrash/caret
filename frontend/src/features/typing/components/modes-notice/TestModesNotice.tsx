import { createMemo, lazy, Show, Suspense } from "solid-js";

import * as Commandline from "../../../../ts/commandline/open";
import { Kbd } from "../../../../ts/components/common/Kbd";
import { getConfig } from "../../../../ts/config/store";
import {
  getCustomTextIndicator,
  getFormatting,
  showCommandLineForConfig,
  isAuthenticated,
} from "../../../../ts/states/core";
import { hotkeys } from "../../../../ts/states/hotkeys";
import {
  getFocus,
  getLoadedChallenge,
  getPaceCaretWpm,
  isPaceRepeat,
  isRepeated,
  wordsHaveNewline,
  wordsHaveTab,
} from "../../../../ts/states/test";
import { cn } from "../../../../ts/utils/cn";
import {
  getLanguageDisplayString,
  replaceUnderscoresWithSpaces,
} from "../../../../ts/utils/strings";
import { getActiveFunboxNames } from "../../runtime/funbox/list";
import { Notice } from "./Notice";
import { PbNotice } from "./PbNotice";

const AverageNotice = lazy(async () =>
  import("./AverageNotice").then((m) => ({ default: m.AverageNotice })),
);
const TagsNotice = lazy(async () =>
  import("./TagsNotice").then((m) => ({ default: m.TagsNotice })),
);

export function TestModesNotice() {
  return (
    <Show when={getConfig.showTestModesNotice}>
      <div
        class={cn(
          "flex flex-wrap justify-center gap-x-4 gap-y-2 text-base text-sub transition-opacity duration-125 select-none sm:gap-y-0",
          {
            "opacity-0": getFocus(),
          },
        )}
      >
        <Repeated />
        <ResultSaving />
        <QuickRestart />
        <LongText />
        <LoadedChallenge />
        <ZenMode />
        <Language />
        <Difficulty />
        <BlindMode />
        <LazyMode />
        <PaceCaretNotice />
        <Show when={isAuthenticated() && getConfig.showAverage !== "off"}>
          <Suspense>
            <AverageNotice />
          </Suspense>
        </Show>
        <PbNotice />
        <MinSpeed />
        <MinAcc />
        <MinBurst />
        <Funbox />
        <ConfidenceMode />
        <StopOnError />
        <DeleteOnError />
        <Layout />
        <OppositeShift />
        <Show when={isAuthenticated()}>
          <Suspense>
            <TagsNotice />
          </Suspense>
        </Show>
      </div>
    </Show>
  );
}

function Repeated() {
  return (
    <Notice
      when={isRepeated() && getConfig.mode !== "quote"}
      class="text-error"
      icon="fa-sync-alt"
      text="repeated"
    />
  );
}

function ResultSaving() {
  return (
    <Notice
      when={!getConfig.resultSaving}
      icon="fa-save"
      openCommandline="resultSaving"
      class="text-error"
      text="saving disabled"
    />
  );
}

function QuickRestart() {
  return (
    <>
      <Notice
        when={wordsHaveTab() && hotkeys.commandPalette === "Shift+Tab"}
        class="pointer-coarse:hidden"
      >
        <Kbd hotkey={hotkeys.commandPalette} /> to open command palette
      </Notice>
      <Notice
        when={
          wordsHaveTab() &&
          (getConfig.quickRestart === "tab" || getConfig.quickRestart === "esc")
        }
        class="pointer-coarse:hidden"
      >
        <Kbd hotkey={hotkeys.quickRestart} /> to restart
      </Notice>

      <Notice
        when={
          getConfig.quickRestart === "enter" &&
          (wordsHaveNewline() || getConfig.funbox.includes("58008"))
        }
      >
        <Kbd hotkey={hotkeys.quickRestart} /> to restart
      </Notice>
    </>
  );
}

function LongText() {
  return (
    <Notice
      when={getConfig.mode === "custom" && getCustomTextIndicator()?.isLong}
      icon="fa-book"
    >
      {getCustomTextIndicator()?.name} (
      <span class="pointer-coarse:hidden">
        <Kbd hotkey="Shift+Enter" /> to save progress)
      </span>
      <span class="hidden pointer-coarse:inline">
        tap save progress when done)
      </span>
    </Notice>
  );
}

function LoadedChallenge() {
  return (
    <Notice
      when={getLoadedChallenge() !== null}
      icon="fa-award"
      openCommandline="loadChallenge"
      text={getLoadedChallenge()?.display}
    />
  );
}

function ZenMode() {
  return (
    <Notice when={getConfig.mode === "zen"}>
      <span class="pointer-coarse:hidden">
        <Kbd hotkey="Shift+Enter" /> to finish zen
      </span>
      <span class="hidden pointer-coarse:inline">tap finish when done</span>
    </Notice>
  );
}

function Language() {
  const isUsingPolyglot = createMemo(() => {
    //react on config.funbox
    const _ = getConfig.funbox;
    return getActiveFunboxNames().includes("polyglot");
  });

  return (
    <>
      <Notice
        when={getConfig.mode !== "zen" && !isUsingPolyglot()}
        icon="fa-globe-americas"
        openCommandline="language"
        text={getLanguageDisplayString(
          getConfig.language,
          getConfig.mode === "quote",
        )}
      />
      <Notice
        when={getConfig.funbox.includes("polyglot")}
        icon="fa-globe-americas"
        onClick={() =>
          Commandline.show({ commandOverride: "setCustomPolyglotCustom" })
        }
        text={getConfig.customPolyglot
          .map((lang) => getLanguageDisplayString(lang, true))
          .join(", ")}
      />
    </>
  );
}

function Difficulty() {
  return (
    <Notice
      when={
        getConfig.difficulty === "expert" || getConfig.difficulty === "master"
      }
      icon={getConfig.difficulty === "expert" ? "fa-star-half-alt" : "fa-star"}
      onClick={() => showCommandLineForConfig("difficulty")}
      text={getConfig.difficulty}
    />
  );
}

function BlindMode() {
  return (
    <Notice
      when={getConfig.blindMode}
      icon="fa-eye-slash"
      openCommandline="blindMode"
      text="blind"
    />
  );
}

function LazyMode() {
  return (
    <Notice
      when={getConfig.lazyMode}
      icon="fa-couch"
      openCommandline="lazyMode"
      text="lazy"
    />
  );
}

function PaceCaretNotice() {
  const displaySpeed = createMemo(() => {
    let type: string = getConfig.paceCaret;
    if (type === "off") type = "custom";
    else if (type === "tagPb") type = "tag pb";

    const format = getFormatting();
    const speed = format.typingSpeed(getPaceCaretWpm() ?? 0, {
      showDecimalPlaces: false,
      suffix: ` ${getConfig.typingSpeedUnit}`,
    });

    return `${type} pace ${speed}`;
  });

  return (
    <Notice
      when={
        getConfig.paceCaret !== "off" ||
        (getConfig.repeatedPace && isPaceRepeat())
      }
      icon="fa-tachometer-alt"
      openCommandline="paceCaret"
      text={displaySpeed()}
    />
  );
}

function MinSpeed() {
  const displaySpeed = createMemo(() => {
    const format = getFormatting();
    const speed = format.typingSpeed(getConfig.minWpmCustomSpeed ?? 0, {
      showDecimalPlaces: false,
      suffix: ` ${getConfig.typingSpeedUnit}`,
    });

    return `min ${speed}`;
  });

  return (
    <Notice
      when={getConfig.minWpm !== "off"}
      icon="fa-bomb"
      openCommandline="minWpm"
      text={displaySpeed()}
    />
  );
}

function MinAcc() {
  const displayAcc = createMemo(() => {
    const format = getFormatting();
    const acc = format.accuracy(getConfig.minAccCustom, {
      showDecimalPlaces: false,
      suffix: " acc",
    });

    return `min ${acc}`;
  });

  return (
    <Notice
      when={getConfig.minAcc !== "off"}
      icon="fa-bomb"
      openCommandline="minAcc"
      text={displayAcc()}
    />
  );
}

function MinBurst() {
  const displaySpeed = createMemo(() => {
    const format = getFormatting();
    const speed = format.typingSpeed(getConfig.minBurstCustomSpeed ?? 0, {
      showDecimalPlaces: false,
      suffix: ` ${getConfig.typingSpeedUnit}`,
    });

    return `min ${speed} burst ${getConfig.minBurst === "flex" ? "(flex)" : ""}`;
  });

  return (
    <Notice
      when={getConfig.minBurst !== "off"}
      icon="fa-bomb"
      openCommandline="minBurst"
      text={displaySpeed()}
    />
  );
}

function Funbox() {
  const funboxes = createMemo(() => {
    //getConfig.funbox doesn't work reactive, wrapping in a memo
    if (getConfig.funbox.length === 0) return undefined;
    return [...getConfig.funbox].map(replaceUnderscoresWithSpaces).join(", ");
  });

  return (
    <Notice
      when={funboxes() !== undefined}
      icon="fa-gamepad"
      openCommandline="funbox"
      text={funboxes()}
    />
  );
}

function ConfidenceMode() {
  return (
    <Notice
      when={getConfig.confidenceMode !== "off"}
      icon="fa-backspace"
      openCommandline="confidenceMode"
      text={
        getConfig.confidenceMode === "max" ? "max confidence" : "confidence"
      }
    />
  );
}

function StopOnError() {
  return (
    <Notice
      when={getConfig.stopOnError !== "off"}
      icon="fa-hand-paper"
      openCommandline="stopOnError"
      text={`stop on ${getConfig.stopOnError}`}
    />
  );
}

function DeleteOnError() {
  return (
    <Notice
      when={getConfig.deleteOnError !== "off"}
      icon="fa-eraser"
      openCommandline="deleteOnError"
      text={`delete on ${replaceUnderscoresWithSpaces(
        getConfig.deleteOnError,
      )}`}
    />
  );
}

function Layout() {
  return (
    <Notice
      when={getConfig.layout !== "default"}
      icon="fa-keyboard"
      openCommandline="layout"
      text={`emulating ${replaceUnderscoresWithSpaces(getConfig.layout)}`}
    />
  );
}

function OppositeShift() {
  return (
    <Notice
      when={getConfig.oppositeShiftMode !== "off"}
      icon="fa-exchange-alt"
      openCommandline="oppositeShiftMode"
      text={`opposite shift${getConfig.oppositeShiftMode === "keymap" ? " (keymap)" : ""}`}
    />
  );
}
