import type * as ConfigSchemas from "@oxytype/schemas/configs";
import { ConfigSchema } from "@oxytype/schemas/configs";
import { roundTo1 } from "@oxytype/util/numbers";
import { getOptions } from "@oxytype/util/zod";

import { getDefaultConfig } from "./default-config";

export type ConfigOptionMetadata = {
  displayString?: string;
  visible?: boolean;
};

/** Client-independent config metadata; clients add icons and notifications. */
export type SharedConfigMetadata<K extends keyof ConfigSchemas.Config> = {
  key: K;
  displayString?: string;
  description?: string;
  optionsMetadata?: ConfigSchemas.Config[K] extends string | number | symbol
    ? Record<ConfigSchemas.Config[K], ConfigOptionMetadata>
    : ConfigSchemas.Config[K] extends boolean
      ? Partial<{
          true: ConfigOptionMetadata;
          false: ConfigOptionMetadata;
        }>
      : never;
  /** Group that this config belongs to. Used for partial presets. */
  group: ConfigSchemas.ConfigGroupName;
  /** Is a test restart required after this config change? */
  changeRequiresRestart: boolean;
  /** Returns why the value cannot be set, or undefined when it can. */
  blockedReason?: (options: {
    value: ConfigSchemas.Config[K];
    currentConfig: Readonly<ConfigSchemas.Config>;
  }) => string | undefined;
  /** Replaces the value before it is set. */
  overrideValue?: (options: {
    value: ConfigSchemas.Config[K];
    currentValue: ConfigSchemas.Config[K];
    currentConfig: Readonly<ConfigSchemas.Config>;
  }) => ConfigSchemas.Config[K];
  /** Other config values to set before this one. */
  overrideConfig?: (options: {
    value: ConfigSchemas.Config[K];
    currentConfig: Readonly<ConfigSchemas.Config>;
  }) => Partial<ConfigSchemas.Config>;
};

export type SharedConfigMetadataObject = {
  [K in keyof ConfigSchemas.Config]: SharedConfigMetadata<K>;
};

const caretOptionsMetadata = {
  banana: {
    visible: false,
  },
  carrot: {
    visible: false,
  },
  monkey: {
    visible: false,
  },
  block: {},
  off: {},
  default: {},
  outline: {},
  underline: {},
};

export const sharedConfigMetadata: SharedConfigMetadataObject = {
  // test
  punctuation: {
    key: "punctuation",
    changeRequiresRestart: true,
    group: "test",
    overrideValue: ({ value, currentConfig }) => {
      if (currentConfig.mode === "quote") {
        return false;
      }
      return value;
    },
  },
  numbers: {
    key: "numbers",
    changeRequiresRestart: true,
    group: "test",
    overrideValue: ({ value, currentConfig }) => {
      if (currentConfig.mode === "quote") {
        return false;
      }
      return value;
    },
  },
  words: {
    key: "words",
    displayString: "word count",
    changeRequiresRestart: true,
    group: "test",
    overrideConfig: ({ currentConfig }) => {
      if (currentConfig.mode !== "words") {
        return {
          mode: "words",
        };
      }
      return {};
    },
  },
  time: {
    key: "time",
    changeRequiresRestart: true,
    displayString: "time",
    group: "test",
    overrideConfig: ({ currentConfig }) => {
      if (currentConfig.mode !== "time") {
        return {
          mode: "time",
        };
      }
      return {};
    },
  },
  mode: {
    key: "mode",
    changeRequiresRestart: true,
    optionsMetadata: {
      time: {},
      words: {},
      quote: {},
      zen: {},
      custom: {},
    },
    group: "test",
    overrideConfig: ({ value }) => {
      if (value === "custom" || value === "quote" || value === "zen") {
        return {
          numbers: false,
          punctuation: false,
        };
      }
      return {};
    },
  },
  quoteLength: {
    key: "quoteLength",
    displayString: "quote length",
    changeRequiresRestart: true,
    group: "test",
    overrideConfig: ({ currentConfig }) => {
      if (currentConfig.mode !== "quote") {
        return {
          mode: "quote",
        };
      }
      return {};
    },
  },
  language: {
    key: "language",
    displayString: "language",
    changeRequiresRestart: true,
    group: "test",
    description: "Change in which language you want to type.",
  },
  burstHeatmap: {
    key: "burstHeatmap",
    displayString: "word burst heatmap",
    changeRequiresRestart: false,
    group: "test",
  },

  // behavior
  difficulty: {
    key: "difficulty",
    changeRequiresRestart: true,
    group: "behavior",
    description:
      "Normal is the classic typing test experience. Expert fails the test if you submit (press space) an incorrect word. Master fails if you press a single incorrect key (meaning you have to achieve 100% accuracy).",
  },
  quickRestart: {
    key: "quickRestart",
    displayString: "quick restart",
    changeRequiresRestart: false,
    group: "behavior",
    description:
      "Press tab, esc or enter to quickly restart the test, or to quickly jump to the test page. These options disable tab navigation on most parts of the website.",
  },
  repeatQuotes: {
    key: "repeatQuotes",
    displayString: "repeat quotes",
    changeRequiresRestart: false,
    group: "behavior",
    description:
      "This setting changes the restarting behavior when typing in quote mode. Changing it to 'typing' will repeat the quote if you restart while typing.",
  },
  resultSaving: {
    key: "resultSaving",
    displayString: "result saving",
    changeRequiresRestart: false,
    group: "behavior",
    description:
      'Set this setting to "off" in case you want to practice without saving new results to your account and affecting your statistics.',
  },
  blindMode: {
    key: "blindMode",
    optionsMetadata: {
      true: {
        // Use an `&ensp;` here so that the `on` button for blind mode will
        // have the same height on both Chromium and Firefox.
        displayString: " ",
      },
    },
    displayString: "blind mode",
    changeRequiresRestart: false,
    group: "behavior",
    description:
      "No errors or incorrect words are highlighted. Helps you to focus on raw speed. If enabled, quick end is recommended.",
  },
  alwaysShowWordsHistory: {
    key: "alwaysShowWordsHistory",
    displayString: "always show words history",
    changeRequiresRestart: false,
    group: "behavior",
    description:
      "This option will automatically show the words history at the end of the test. Can cause slight lag with a lot of words.",
  },
  singleListCommandLine: {
    key: "singleListCommandLine",
    displayString: "single list command palette",
    changeRequiresRestart: false,
    group: "behavior",
    description:
      "When enabled, it will show the command palette with all commands in a single list instead of submenu arrangements. Selecting 'manual' will expose all commands only after typing >.",
  },
  commandPaletteHotkey: {
    key: "commandPaletteHotkey",
    displayString: "command palette shortcut",
    changeRequiresRestart: false,
    group: "behavior",
    description:
      "Keyboard shortcut that opens the command palette. Shortcuts used by the browser, the operating system or quick restart are not allowed.",
  },
  minWpm: {
    key: "minWpm",
    displayString: "min speed",
    changeRequiresRestart: true,
    group: "behavior",
    description:
      "Automatically fails a test if your speed falls below a threshold.",
  },
  minWpmCustomSpeed: {
    key: "minWpmCustomSpeed",
    displayString: "min speed custom",
    changeRequiresRestart: true,
    group: "behavior",
    overrideConfig: ({ currentConfig }) => {
      if (currentConfig.minWpm !== "custom") {
        return {
          minWpm: "custom",
        };
      }
      return {};
    },
  },
  minAcc: {
    key: "minAcc",
    displayString: "min accuracy",
    changeRequiresRestart: true,
    group: "behavior",
    description:
      "Automatically fails a test if your accuracy falls below a threshold.",
  },
  minAccCustom: {
    key: "minAccCustom",
    displayString: "min accuracy custom",
    changeRequiresRestart: true,
    group: "behavior",
    overrideConfig: ({ currentConfig }) => {
      if (currentConfig.minAcc !== "custom") {
        return {
          minAcc: "custom",
        };
      }
      return {};
    },
  },
  minBurst: {
    key: "minBurst",
    displayString: "min word burst",
    changeRequiresRestart: true,
    group: "behavior",
    description:
      "Automatically fails a test if your raw for a single word falls below this threshold. Selecting 'flex' allows for this threshold to automatically decrease for longer words.",
  },
  minBurstCustomSpeed: {
    key: "minBurstCustomSpeed",
    displayString: "min word burst custom speed",
    changeRequiresRestart: true,
    group: "behavior",
  },
  britishEnglish: {
    key: "britishEnglish",
    displayString: "british english",
    changeRequiresRestart: true,
    group: "behavior",
    description:
      "When enabled, the website will use the British spelling instead of American. Note that this might not replace all words correctly. If you find any issues, please let us know.",
  },
  funbox: {
    key: "funbox",
    changeRequiresRestart: true,
    group: "behavior",
    description:
      "These are special modes that change the website in some special way (by altering the word generation, behavior of the website or the looks). Give each one of them a try!",
  },
  customLayoutfluid: {
    key: "customLayoutfluid",
    displayString: "custom layoutfluid",
    changeRequiresRestart: true,
    group: "behavior",
    description:
      "Select which layouts you want the layoutfluid funbox to cycle through.",
    overrideValue: ({ value }) => {
      return Array.from(new Set(value));
    },
  },
  customPolyglot: {
    key: "customPolyglot",
    displayString: "polyglot languages",
    changeRequiresRestart: false,
    group: "behavior",
    description: "Select which languages you want the polyglot funbox to use.",
    overrideValue: ({ value }) => {
      return Array.from(new Set(value));
    },
  },

  // input
  freedomMode: {
    key: "freedomMode",
    changeRequiresRestart: false,
    displayString: "freedom mode",
    group: "input",
    description:
      "Allows you to delete any word, even if it was typed correctly.",
    overrideConfig: ({ value }) => {
      if (value) {
        return {
          confidenceMode: "off",
        };
      }
      return {};
    },
  },
  strictSpace: {
    key: "strictSpace",
    displayString: "strict space",
    changeRequiresRestart: true,
    group: "input",
    description:
      "Pressing space at the beginning of a word will insert a space character when this mode is enabled.",
  },
  oppositeShiftMode: {
    key: "oppositeShiftMode",
    displayString: "opposite shift mode",
    changeRequiresRestart: false,
    group: "input",
    description:
      'This mode will force you to use opposite shift keys for shifting. Using an incorrect one will count as an error. This feature ignores keys in locations B, Y, and ^ because many people use the other hand for those keys. If you\'re using external software to emulate your layout (including QMK), you should use the "keymap" mode - the standard "on" will not work. This will enforce opposite shift based on the "keymap layout" setting.',
  },
  stopOnError: {
    key: "stopOnError",
    displayString: "stop on error",
    changeRequiresRestart: true,
    group: "input",
    description:
      "Letter mode will stop input when pressing any incorrect letters. Word mode will not allow you to continue to the next word until you correct all mistakes.",
    overrideConfig: ({ value }) => {
      if (value !== "off") {
        return {
          confidenceMode: "off",
          deleteOnError: "off",
        };
      }
      return {};
    },
  },
  deleteOnError: {
    key: "deleteOnError",
    displayString: "delete on error",
    changeRequiresRestart: false,
    group: "input",
    description:
      "Letter deletes the incorrect character and the character before it. Word deletes the current word. The hard modes also go back to the previous word if the first character is incorrect.",
    overrideConfig: ({ value }) => {
      if (value !== "off") {
        return {
          confidenceMode: "off",
          stopOnError: "off",
        };
      }
      return {};
    },
  },
  confidenceMode: {
    key: "confidenceMode",
    displayString: "confidence mode",
    changeRequiresRestart: false,
    group: "input",
    description:
      "When enabled, you will not be able to go back to previous words to fix mistakes. When turned up to the max, you won't be able to backspace at all.",
    overrideConfig: ({ value }) => {
      if (value !== "off") {
        return {
          freedomMode: false,
          stopOnError: "off",
          deleteOnError: "off",
        };
      }
      return {};
    },
  },
  quickEnd: {
    key: "quickEnd",
    displayString: "quick end",
    changeRequiresRestart: false,
    group: "input",
    description:
      "This only applies to the words mode - when enabled, the test will end as soon as the last word has been typed, even if it's incorrect. When disabled, you need to manually confirm the last incorrect entry with a space.",
  },
  indicateTypos: {
    key: "indicateTypos",
    displayString: "indicate typos",
    changeRequiresRestart: false,
    group: "input",
    description:
      'Shows typos that you\'ve made. "Below" shows what you typed below the letters, "replace" will replace the letters with the ones you typed and "both" will do the same as replace and below, but it will show the correct letters below your mistakes.',
  },
  compositionDisplay: {
    key: "compositionDisplay",
    displayString: "composition display",
    changeRequiresRestart: false,
    group: "input",
    description:
      'Change how composition is displayed. "off" will just underline the letter if composition is active. "below" will show the composed character below the test. "replace" will replace the letter in the test with the composed character.',
  },
  hideExtraLetters: {
    key: "hideExtraLetters",
    displayString: "hide extra letters",
    changeRequiresRestart: false,
    group: "input",
    description:
      "Hides extra letters. This will completely avoid words jumping lines (due to changing width), but might feel a bit confusing when you press a key and nothing happens.",
  },
  lazyMode: {
    key: "lazyMode",
    displayString: "lazy mode",
    changeRequiresRestart: true,
    group: "input",
    description:
      "Replaces accents / diacritics / special characters with their normal letter equivalents.",
  },
  layout: {
    key: "layout",
    displayString: "layout",
    changeRequiresRestart: true,
    group: "input",
    description:
      "With this setting you can emulate other layouts. This setting is best kept off, as it can break things like dead keys and alt layers.",
  },
  codeUnindentOnBackspace: {
    key: "codeUnindentOnBackspace",
    displayString: "code unindent on backspace",
    changeRequiresRestart: true,
    group: "input",
    description:
      "Automatically go back to the previous line when deleting line leading tab characters. Only works in code languages.",
  },

  // sound
  soundVolume: {
    key: "soundVolume",
    displayString: "sound volume",
    changeRequiresRestart: false,
    group: "sound",
    description: "Change the volume of the sound effects.",
  },
  playSoundOnClick: {
    key: "playSoundOnClick",
    optionsMetadata: {
      off: {},
      "1": { displayString: "click" },
      "2": { displayString: "beep" },
      "3": { displayString: "pop" },
      "4": { displayString: "nk creams" },
      "5": { displayString: "typewriter" },
      "6": { displayString: "osu" },
      "7": { displayString: "hitmarker" },
      "8": { displayString: "sine" },
      "9": { displayString: "sawtooth" },
      "10": { displayString: "square" },
      "11": { displayString: "triangle" },
      "12": { displayString: "pentatonic" },
      "13": { displayString: "wholetone" },
      "14": { displayString: "fist fight" },
      "15": { displayString: "rubber keys" },
      "16": { displayString: "fart" },
      "17": { displayString: "akko lavenders" },
      "18": { displayString: "cherrymx black abs" },
      "19": { displayString: "cherrymx black pbt" },
      "20": { displayString: "cherrymx blue abs" },
      "21": { displayString: "cherrymx blue pbt" },
      "22": { displayString: "cherrymx brown pbt" },
      "23": { displayString: "kalih box white" },
      "24": { displayString: "razer green" },
      "25": { displayString: "tealios v2" },
      "26": { displayString: "trust gxt" },
    },
    displayString: "play sound on click",
    changeRequiresRestart: false,
    group: "sound",
    description: "Plays a short sound when you press a key.",
  },
  playSoundOnError: {
    key: "playSoundOnError",
    optionsMetadata: {
      off: {},
      "1": { displayString: "damage" },
      "2": { displayString: "triangle" },
      "3": { displayString: "square" },
      "4": { displayString: "missed punch" },
    },
    displayString: "play sound on error",
    changeRequiresRestart: false,
    group: "sound",
    description:
      "Plays a short sound if you press an incorrect key or press space too early.",
  },
  playTimeWarning: {
    key: "playTimeWarning",
    optionsMetadata: {
      off: {},
      "1": { displayString: "1 second" },
      "3": { displayString: "3 seconds" },
      "5": { displayString: "5 seconds" },
      "10": { displayString: "10 seconds" },
    },
    displayString: "play time warning",
    changeRequiresRestart: false,
    group: "sound",
    description:
      "Play a short warning sound if you are close to the end of a timed test.",
  },

  // caret
  smoothCaret: {
    key: "smoothCaret",
    displayString: "smooth caret",
    changeRequiresRestart: false,
    group: "caret",
    description: "The caret will move smoothly between letters and words.",
  },
  caretStyle: {
    key: "caretStyle",
    displayString: "caret style",
    changeRequiresRestart: false,
    group: "caret",
    description: "Change the style of the caret during the test.",
    optionsMetadata: caretOptionsMetadata,
  },
  paceCaret: {
    key: "paceCaret",
    displayString: "pace caret",
    changeRequiresRestart: false,
    group: "caret",
    description:
      "Displays a second caret that moves at constant speed. The 'average' option averages the speed of last 10 results. The 'tag pb' option takes the highest PB of any active tag. The 'daily' option takes the highest speed of the last 24 hours.",
    optionsMetadata: {
      tagPb: {
        displayString: "tag pb",
      },
      average: {},
      custom: {},
      daily: {},
      last: {},
      off: {},
      pb: {},
    },
  },
  paceCaretCustomSpeed: {
    key: "paceCaretCustomSpeed",
    displayString: "pace caret custom speed",
    changeRequiresRestart: false,
    group: "caret",
    overrideConfig: ({ currentConfig }) => {
      if (currentConfig.paceCaret !== "custom") {
        return {
          paceCaret: "custom",
        };
      }
      return {};
    },
  },
  paceCaretStyle: {
    key: "paceCaretStyle",
    displayString: "pace caret style",
    changeRequiresRestart: false,
    group: "caret",
    description: "Change the style of the pace caret during the test.",
    optionsMetadata: caretOptionsMetadata,
  },
  repeatedPace: {
    key: "repeatedPace",
    displayString: "repeated pace",
    changeRequiresRestart: false,
    group: "caret",
    description:
      "When repeating a test, a pace caret will automatically be enabled for one test with the speed of your previous test. It does not override the pace caret if it's already enabled.",
  },

  // appearance
  timerStyle: {
    key: "timerStyle",
    displayString: "live progress style",
    changeRequiresRestart: false,
    group: "appearance",
    description:
      'Change the style of the timer/word count during a test. "Flash" styles will briefly show the timer in timed modes every 15 seconds.',
  },
  liveSpeedStyle: {
    key: "liveSpeedStyle",
    displayString: "live speed style",
    changeRequiresRestart: false,
    group: "appearance",
    description:
      "Change the style of the live speed displayed during the test.",
    overrideConfig: ({ value }) => {
      if (value === "text") {
        return {
          monkey: false,
        };
      }
      return {};
    },
  },
  liveAccStyle: {
    key: "liveAccStyle",
    displayString: "live accuracy style",
    changeRequiresRestart: false,
    group: "appearance",
    description:
      "Change the style of the live accuracy displayed during the test.",
    overrideConfig: ({ value }) => {
      if (value === "text") {
        return {
          monkey: false,
        };
      }
      return {};
    },
  },
  liveBurstStyle: {
    key: "liveBurstStyle",
    displayString: "live word burst style",
    changeRequiresRestart: false,
    group: "appearance",
    description:
      "Change the style of the live burst speed displayed during the test.",
  },
  timerColor: {
    key: "timerColor",
    displayString: "timer color",
    changeRequiresRestart: false,
    group: "appearance",
    description:
      "Change the color of the progress, live speed, accuracy and burst text.",
  },
  timerOpacity: {
    key: "timerOpacity",
    displayString: "timer opacity",
    changeRequiresRestart: false,
    group: "appearance",
    description:
      "Change the opacity of the progress, live speed, burst and accuracy text.",
  },
  highlightMode: {
    key: "highlightMode",
    displayString: "highlight mode",
    changeRequiresRestart: false,
    group: "appearance",
    description: "Change what is highlighted during the test.",
  },
  typedEffect: {
    key: "typedEffect",
    displayString: "typed effect",
    changeRequiresRestart: false,
    group: "appearance",
    description: "Change how typed words are shown.",
  },
  tapeMode: {
    key: "tapeMode",
    changeRequiresRestart: false,
    displayString: "tape mode",
    group: "appearance",
    description:
      "Only shows one line which scrolls horizontally. Setting this to 'word' will make it scroll after every word and 'letter' will scroll after every keypress. Works best with smooth line scroll enabled and a monospace font.",
    overrideConfig: ({ value }) => {
      if (value !== "off") {
        return {
          showAllLines: false,
        };
      }
      return {};
    },
  },
  tapeMargin: {
    key: "tapeMargin",
    displayString: "tape margin",
    changeRequiresRestart: false,
    group: "appearance",
    description:
      "When in tape mode, set the carets position from the left edge of the typing test as a percentage (for example, 50% centers it).",
  },
  smoothLineScroll: {
    key: "smoothLineScroll",
    displayString: "smooth line scroll",
    changeRequiresRestart: false,
    group: "appearance",
    description: "When enabled, the line transition will be animated.",
  },
  showAllLines: {
    key: "showAllLines",
    changeRequiresRestart: false,
    displayString: "show all lines",
    group: "appearance",
    description:
      "When enabled, the website will show all lines for word, custom and quote mode tests - otherwise the lines will be limited to 3, and will automatically scroll. Using this could cause the timer text and live speed to not be visible.",
    blockedReason: ({ value, currentConfig }) =>
      value && currentConfig.tapeMode !== "off"
        ? "Show all lines doesn't support tape mode."
        : undefined,
  },
  alwaysShowDecimalPlaces: {
    key: "alwaysShowDecimalPlaces",
    displayString: "always show decimal places",
    changeRequiresRestart: false,
    group: "appearance",
    description:
      "Always shows decimal places for values on the result page, without the need to hover over the stats.",
  },
  typingSpeedUnit: {
    key: "typingSpeedUnit",
    displayString: "typing speed unit",
    changeRequiresRestart: false,
    group: "appearance",
    description: "Display typing speed in the specified unit.",
  },
  startGraphsAtZero: {
    key: "startGraphsAtZero",
    displayString: "start graphs at zero",
    changeRequiresRestart: false,
    group: "appearance",
    description:
      "Force graph axis to always start at zero, no matter what the data is. Turning this off may exaggerate the value changes.",
  },
  maxLineWidth: {
    key: "maxLineWidth",
    changeRequiresRestart: false,
    displayString: "max line width",
    group: "appearance",
    description:
      "Change the maximum width of the typing test, measured in characters. Setting this to 0 will align the words to the edges of the content area.",
  },
  fontSize: {
    key: "fontSize",
    changeRequiresRestart: false,
    displayString: "font size",
    group: "appearance",
    description: "Change the font size of the test words.",
  },
  fontFamily: {
    key: "fontFamily",
    displayString: "font family",
    changeRequiresRestart: false,
    group: "appearance",
    description:
      "Change the font family used by the website. Using a local font will override your choice. ",
    optionsMetadata: {
      Comic_Sans_MS: {
        displayString: "Helvetica",
      },
    },
  },
  keymapMode: {
    key: "keymapMode",
    displayString: "keymap mode",
    changeRequiresRestart: false,
    group: "appearance",
    description:
      "Displays your current layout while taking a test. React shows what you pressed and Next shows what you need to press next.",
  },
  keymapLayout: {
    key: "keymapLayout",
    displayString: "keymap layout",
    changeRequiresRestart: false,
    group: "appearance",
    description: "Controls which layout is displayed on the keymap.",
    overrideConfig: ({ currentConfig }) =>
      currentConfig.keymapMode === "off" ? { keymapMode: "static" } : {},
  },
  keymapStyle: {
    key: "keymapStyle",
    displayString: "keymap style",
    changeRequiresRestart: false,
    group: "appearance",
    overrideConfig: ({ currentConfig }) =>
      currentConfig.keymapMode === "off" ? { keymapMode: "static" } : {},
  },
  keymapLegendStyle: {
    key: "keymapLegendStyle",
    displayString: "keymap legend style",
    changeRequiresRestart: false,
    group: "appearance",
    overrideConfig: ({ currentConfig }) =>
      currentConfig.keymapMode === "off" ? { keymapMode: "static" } : {},
  },
  keymapKeys: {
    key: "keymapKeys",
    displayString: "keymap keys",
    changeRequiresRestart: false,
    group: "appearance",
    overrideConfig: ({ currentConfig }) =>
      currentConfig.keymapMode === "off" ? { keymapMode: "static" } : {},
  },
  keymapSize: {
    key: "keymapSize",
    changeRequiresRestart: false,
    displayString: "keymap size",
    group: "appearance",
    description: "Change the size of the keymap.",
    overrideValue: ({ value }) => {
      if (value < 0.5) value = 0.5;
      if (value > 3.5) value = 3.5;
      return roundTo1(value);
    },
    overrideConfig: ({ currentConfig }) =>
      currentConfig.keymapMode === "off" ? { keymapMode: "static" } : {},
  },

  // theme
  flipTestColors: {
    key: "flipTestColors",
    displayString: "flip test colors",
    changeRequiresRestart: false,
    group: "theme",
    description:
      "By default, typed text is brighter than the future text. When enabled, the colors will be flipped and the future text will be brighter than the already typed text.",
  },
  colorfulMode: {
    key: "colorfulMode",
    displayString: "colorful mode",
    changeRequiresRestart: false,
    group: "theme",
    description:
      "When enabled, the test words will use the main color, instead of the text color, making the website more colorful.",
  },
  customBackground: {
    key: "customBackground",
    displayString: "custom background",
    changeRequiresRestart: false,
    group: "theme",
    overrideValue: ({ value }) => {
      return value.trim();
    },
    description:
      "Set an image url or local image to be a custom background image. Local image always take priority over the image url. Cover fits the image to cover the screen. Contain fits the image to be fully visible. Max fits the image corner to corner.",
  },
  customBackgroundSize: {
    key: "customBackgroundSize",
    displayString: "custom background size",
    changeRequiresRestart: false,
    group: "theme",
    description:
      "Set an image url or local image to be a custom background image. Cover fits the image to cover the screen. Contain fits the image to be fully visible. Max fits the image corner to corner.",
  },
  customBackgroundFilter: {
    key: "customBackgroundFilter",
    displayString: "custom background filter",
    changeRequiresRestart: false,
    group: "theme",
    description: "Apply various effects to the custom background.",
  },
  autoSwitchTheme: {
    key: "autoSwitchTheme",
    displayString: "auto switch theme",
    changeRequiresRestart: false,
    group: "theme",
    description:
      "Enabling this will automatically switch the theme between light and dark depending on the system theme.",
  },
  themeLight: {
    key: "themeLight",
    displayString: "theme light",
    changeRequiresRestart: false,
    group: "theme",
  },
  themeDark: {
    key: "themeDark",
    displayString: "theme dark",
    changeRequiresRestart: false,
    group: "theme",
  },
  randomTheme: {
    key: "randomTheme",
    changeRequiresRestart: false,
    displayString: "random theme",
    group: "theme",
    description:
      "After completing a test, the theme will be set to a random one. The random themes are not saved to your config. If set to 'favorite' only favorite themes will be randomized. If set to 'light' or 'dark', only presets with light or dark background colors will be randomized, respectively. If set to 'auto' dark or light themes are used, depending on your system theme. If set to 'custom', custom themes will be randomized.",
    optionsMetadata: {
      fav: {
        displayString: "favorite",
      },
      auto: {},
      custom: {},
      dark: {},
      light: {},
      off: {},
      on: {},
    },
  },
  favThemes: {
    key: "favThemes",
    displayString: "favorite themes",
    changeRequiresRestart: false,
    group: "theme",
  },
  theme: {
    key: "theme",
    changeRequiresRestart: false,
    group: "theme",
    description:
      "Completely change the look and feel of the website by picking one of the presets, or by creating your own completely custom theme.",
    overrideConfig: () => {
      return {
        customTheme: false,
      };
    },
  },
  customTheme: {
    key: "customTheme",
    displayString: "custom theme",
    changeRequiresRestart: false,
    group: "theme",
  },
  customThemeColors: {
    key: "customThemeColors",
    displayString: "custom theme colors",
    changeRequiresRestart: false,
    group: "theme",
    overrideValue: ({ value }) => {
      const allColorsThesame = value.every((color) => color === value[0]);
      if (allColorsThesame) {
        return getDefaultConfig().customThemeColors;
      } else {
        return value;
      }
    },
  },

  // hide elements
  showKeyTips: {
    key: "showKeyTips",
    displayString: "show key tips",
    changeRequiresRestart: false,
    group: "hideElements",
    description: "Shows the keybind tips at the bottom of the page.",
    optionsMetadata: {
      true: { displayString: "show" },
      false: { displayString: "hide" },
    },
  },
  showOutOfFocusWarning: {
    key: "showOutOfFocusWarning",
    displayString: "show out of focus warning",
    changeRequiresRestart: false,
    group: "hideElements",
    description:
      "Shows an out of focus reminder after 1 second of being 'out of focus' (not being able to type).",
    optionsMetadata: {
      true: { displayString: "show" },
      false: { displayString: "hide" },
    },
  },
  showTestModesNotice: {
    key: "showTestModesNotice",
    displayString: "show test modes notice",
    changeRequiresRestart: false,
    group: "hideElements",
    description:
      "Shows the active test settings above the words, such as language, pace caret and funbox.",
    optionsMetadata: {
      true: { displayString: "show" },
      false: { displayString: "hide" },
    },
  },
  capsLockWarning: {
    key: "capsLockWarning",
    displayString: "caps lock warning",
    changeRequiresRestart: false,
    group: "hideElements",
    description: "Displays a warning when caps lock is on.",
    optionsMetadata: {
      true: { displayString: "show" },
      false: { displayString: "hide" },
    },
  },
  showAverage: {
    key: "showAverage",
    displayString: "show average",
    changeRequiresRestart: false,
    group: "hideElements",
    description:
      "Displays your average speed and/or accuracy over the last 10 tests.",
  },
  showPb: {
    key: "showPb",
    displayString: "show personal best",
    changeRequiresRestart: false,
    group: "hideElements",
  },

  // other (hidden)
  accountChart: {
    key: "accountChart",
    displayString: "account chart",
    changeRequiresRestart: false,
    group: "hidden",
    overrideValue: ({ value, currentValue }) => {
      // if both speed and accuracy are off, set opposite to on
      // i dedicate this fix to AshesOfAFallen and our 2 collective brain cells
      if (value[0] === "off" && value[1] === "off") {
        const changedIndex = value[0] === currentValue[0] ? 0 : 1;
        value[changedIndex] = "on";
      }
      return value;
    },
  },
  monkey: {
    key: "monkey",
    // Retained for compatibility with saved configs; the mascot was removed.
    displayString: "legacy mascot",
    changeRequiresRestart: false,
    group: "hidden",
    overrideConfig: ({ value, currentConfig }) => {
      if (value) {
        return {
          liveSpeedStyle:
            currentConfig.liveSpeedStyle === "text"
              ? "mini"
              : currentConfig.liveSpeedStyle,
          liveAccStyle:
            currentConfig.liveAccStyle === "text"
              ? "mini"
              : currentConfig.liveAccStyle,
        };
      }
      return {};
    },
  },
  monkeyPowerLevel: {
    key: "monkeyPowerLevel",
    displayString: "typing power level",
    changeRequiresRestart: false,
    group: "hidden",
  },
};

function getOptionMetadata<K extends keyof ConfigSchemas.Config>(
  key: K,
  option: ConfigSchemas.Config[K],
): ConfigOptionMetadata | undefined {
  return (
    sharedConfigMetadata[key] as {
      optionsMetadata?: Record<string, ConfigOptionMetadata> | undefined;
    }
  ).optionsMetadata?.[String(option)];
}

/** The selectable options for a config key, excluding hidden ones. */
export function getVisibleOptions<K extends keyof ConfigSchemas.Config>(
  key: K,
): ConfigSchemas.Config[K][] | undefined {
  return getOptions(ConfigSchema.shape[key])?.filter(
    (option) =>
      getOptionMetadata(key, option as ConfigSchemas.Config[K])?.visible !==
      false,
  ) as ConfigSchemas.Config[K][] | undefined;
}

/** The label shown for a single option, also used for search. */
export function getOptionLabel<K extends keyof ConfigSchemas.Config>(
  key: K,
  option: ConfigSchemas.Config[K],
): string {
  const optionMeta = getOptionMetadata(key, option);
  if (optionMeta?.displayString !== undefined) return optionMeta.displayString;
  if (option === true) return "on";
  if (option === false) return "off";
  return String(option).replace(/_/g, " ");
}

/** All visible option labels joined, so search can match on them. */
export function getOptionSearchKeywords(
  key: keyof ConfigSchemas.Config,
): string {
  return (getVisibleOptions(key) ?? [])
    .map((option) => getOptionLabel(key, option))
    .join(" ");
}
