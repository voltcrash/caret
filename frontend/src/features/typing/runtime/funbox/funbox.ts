import { captureTypingRoute } from "../../scope";
import {
  setFunboxBodyClasses as setBodyClasses,
  setFunboxStylesheets,
  setFunboxReducedMotionIgnored,
  setWordsWrapperVisible,
} from "../../../../ts/states/funbox";
import {
  showNoticeNotification,
  showErrorNotification,
} from "../../../../ts/states/notifications";
import * as JSONData from "../../../../ts/utils/json-data";
import * as Strings from "../../../../ts/utils/strings";
import { getMutableConfig } from "../../../../ts/config/store";
import {
  toggleFunbox as configToggleFunbox,
  setConfig,
} from "../../../../ts/config/setters";
import * as MemoryTimer from "./memory-funbox-timer";
import * as FunboxMemory from "./funbox-memory";
import { HighlightMode, FunboxName } from "@oxytype/schemas/configs";
import { Mode } from "@oxytype/schemas/shared";
import { checkCompatibility, checkForcedConfig } from "@oxytype/funbox";
import {
  getAllFunboxes,
  getActiveFunboxes,
  getActiveFunboxNames,
  getActiveFunboxesWithFunction,
  isFunboxActiveWithProperty,
  getActiveFunboxesWithProperty,
} from "./list";
import { tryCatch } from "@oxytype/util/trycatch";
import { configEvent } from "../../../../ts/events/config";

export function toggleScript(...params: string[]): void {
  if (getMutableConfig().funbox.length === 0) return;

  for (const fb of getActiveFunboxesWithFunction("toggleScript")) {
    fb.functions.toggleScript(params);
  }
}

export function setFunbox(funbox: FunboxName[]): boolean {
  FunboxMemory.load();
  setConfig("funbox", funbox);
  return true;
}

export function toggleFunbox(funbox: FunboxName): void {
  if (
    !checkCompatibility(getActiveFunboxNames(), funbox) &&
    !getMutableConfig().funbox.includes(funbox)
  ) {
    showNoticeNotification(
      `${Strings.capitalizeFirstLetter(
        funbox.replace(/_/g, " "),
      )} funbox is not compatible with the current funbox selection`,
    );
    return;
  }
  FunboxMemory.load();
  configToggleFunbox(funbox, false);
}

export async function clear(): Promise<boolean> {
  setBodyClasses([]);
  setFunboxStylesheets([]);
  setWordsWrapperVisible(true);
  setFunboxReducedMotionIgnored(false);
  MemoryTimer.reset();
  return true;
}

export async function activate(
  funbox?: FunboxName[],
): Promise<boolean | undefined> {
  const lease = captureTypingRoute();
  if (!lease.isCurrent()) return false;
  if (funbox === undefined || funbox === null) {
    funbox = getMutableConfig().funbox;
  } else if (getMutableConfig().funbox !== funbox) {
    getMutableConfig().funbox = funbox;
  }

  // The configuration might be edited with dev tools,
  // so we need to double check its validity
  if (!checkCompatibility(getActiveFunboxNames())) {
    showErrorNotification(
      `Failed to activate funbox: funboxes ${getMutableConfig()
        .funbox.map((it) => it.replace(/_/g, " "))
        .join(", ")} are not compatible`,
    );
    setConfig("funbox", [], {
      nosave: true,
    });
    await clear();
    return false;
  }

  MemoryTimer.reset();
  await setFunboxBodyClasses();
  if (!lease.isCurrent()) return false;
  await applyFunboxCSS();
  if (!lease.isCurrent()) return false;

  setWordsWrapperVisible(true);

  const { data: language, error } = await tryCatch(
    JSONData.getCurrentLanguage(getMutableConfig().language),
  );
  if (!lease.isCurrent()) return false;
  if (error) {
    showErrorNotification("Failed to activate funbox", { error });
    setConfig("funbox", [], {
      nosave: true,
    });
    await clear();
    return false;
  }

  if (language.joiningScript) {
    if (isFunboxActiveWithProperty("noJoiningScript")) {
      showNoticeNotification(
        "Current language does not support this funbox mode",
      );
      setConfig("funbox", [], {
        nosave: true,
      });
      await clear();
      return;
    }
  }

  let canSetSoFar = true;

  for (const [configKey, configValue] of Object.entries(getMutableConfig())) {
    const check = checkForcedConfig(
      configKey,
      configValue,
      getActiveFunboxes(),
    );
    if (check.result) continue;
    if (!check.result) {
      if (check.forcedConfigs && check.forcedConfigs.length > 0) {
        if (configKey === "mode") {
          setConfig("mode", check.forcedConfigs[0] as Mode);
        }
        if (configKey === "words") {
          setConfig("words", check.forcedConfigs[0] as number);
        }
        if (configKey === "time") {
          setConfig("time", check.forcedConfigs[0] as number);
        }
        if (configKey === "punctuation") {
          setConfig("punctuation", check.forcedConfigs[0] as boolean);
        }
        if (configKey === "numbers") {
          setConfig("numbers", check.forcedConfigs[0] as boolean);
        }
        if (configKey === "highlightMode") {
          setConfig("highlightMode", check.forcedConfigs[0] as HighlightMode);
        }
      } else {
        canSetSoFar = false;
        break;
      }
    }
  }

  if (!canSetSoFar) {
    if (getMutableConfig().funbox.length > 1) {
      showErrorNotification(
        `Failed to activate funboxes ${getMutableConfig().funbox}: no intersecting forced configs. Disabling funbox`,
      );
    } else {
      showErrorNotification(
        `Failed to activate funbox ${getMutableConfig().funbox}: no forced configs. Disabling funbox`,
      );
    }
    setConfig("funbox", [], {
      nosave: true,
    });
    await clear();
    return;
  }

  for (const fb of getActiveFunboxesWithFunction("applyConfig")) {
    fb.functions.applyConfig();
  }
  return true;
}

export async function rememberSettings(): Promise<void> {
  for (const fb of getActiveFunboxesWithFunction("rememberSettings")) {
    fb.functions.rememberSettings();
  }
}

async function setFunboxBodyClasses(): Promise<boolean> {
  setBodyClasses(
    getActiveFunboxNames().map((name) => `fb-${name.replaceAll("_", "-")}`),
  );
  if (isFunboxActiveWithProperty("ignoreReducedMotion")) {
    setFunboxReducedMotionIgnored(true);
  }
  return true;
}

async function applyFunboxCSS(): Promise<boolean> {
  // Fresh objects recreate links on each activation, like legacy remove/append.
  setFunboxStylesheets(
    getActiveFunboxesWithProperty("hasCssFile").map(({ name }) => ({ name })),
  );
  return true;
}

export function useFunboxEvents(): void {
  configEvent.useListener(async ({ key }) => {
    if (key === "funbox") {
      const active = getActiveFunboxNames();
      getAllFunboxes()
        .filter((it) => !active.includes(it.name))
        .forEach((it) => it.functions?.clearGlobal?.());

      for (const fb of getActiveFunboxesWithFunction("applyGlobalCSS")) {
        fb.functions.applyGlobalCSS();
      }
    }
  });
}
