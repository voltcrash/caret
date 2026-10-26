import type { ChallengeName } from "@caret/schemas/challenges";
import type { Challenge } from "../types";

export const funboxChallenges = {
  beLikeWater: {
    display: "Be like water",
    category: "funbox",
    description:
      "Achieve at least 50 WPM in all three layouts in a 60-second time test using the layoutfluid mode. Layouts must be unique (e.g., QWERTY, Colemak, Dvorak).",
    settings: {
      type: "funbox",
      message: "Remember: You need to achieve at least 50 wpm in each layout.",
      parameters: { funbox: "layoutfluid", mode: "time", mode2: 60 },
    },
  },
  rollercoaster: {
    display: "Rollercoaster",
    category: "funbox",
    description:
      "Complete at least a one-hour test using the round round baby mode.",
    settings: {
      type: "funbox",
      parameters: { funbox: "round_round_baby", mode: "time", mode2: 3600 },
      requirements: {
        time: { min: 3600 },
        funbox: { exact: ["round_round_baby"] },
      },
    },
  },
  oneHourMirror: {
    display: "ɿoɿɿim ɿυoʜ ɘno",
    category: "funbox",
    description: "Complete at least a one-hour test using the mirror mode.",
    settings: {
      type: "funbox",
      parameters: { funbox: "mirror", mode: "time", mode2: 3600 },
      requirements: { time: { min: 3600 }, funbox: { exact: ["mirror"] } },
    },
  },
  chooChoo: {
    display: "Choo choo",
    category: "funbox",
    description: "Complete at least a one-hour test using choo choo mode.",
    settings: {
      type: "funbox",
      parameters: { funbox: "choo_choo", mode: "time", mode2: 3600 },
      requirements: { time: { min: 3600 }, funbox: { exact: ["choo_choo"] } },
    },
  },
  mnemonist: {
    display: "Mnemonist",
    category: "funbox",
    description:
      "Achieve 100+ WPM with 100% accuracy on a 25-word test using the memory funbox.",
    settings: {
      type: "funbox",
      parameters: {
        funbox: "memory",
        mode: "words",
        mode2: 25,
        difficulty: "master",
      },
      requirements: { config: { tapeMode: "off" } },
    },
  },
  earfquake: {
    display: "Earfquake",
    category: "funbox",
    description:
      "Complete at least a one-hour test using the earthquake funbox mode.",
    settings: {
      type: "funbox",
      parameters: { funbox: "earthquake", mode: "time", mode2: 3600 },
      requirements: { time: { min: 3600 }, funbox: { exact: ["earthquake"] } },
    },
  },
  simonSez: {
    display: "Simon Sez",
    category: "funbox",
    description:
      "Complete at least a one-hour test using the simon says funbox mode.",
    settings: {
      type: "funbox",
      parameters: { funbox: "simon_says", mode: "time", mode2: 3600 },
      requirements: { time: { min: 3600 }, funbox: { exact: ["simon_says"] } },
    },
  },
  accountant: {
    display: "Accountant",
    category: "funbox",
    description:
      "Complete at least a one-hour test using the 58008 funbox mode.",
    settings: {
      type: "funbox",
      parameters: { funbox: "58008", mode: "time", mode2: 3600 },
      requirements: { time: { min: 3600 }, funbox: { exact: ["58008"] } },
    },
  },
  hidden: {
    display: "Hidden",
    category: "funbox",
    description:
      "Achieve 100+ WPM using the read ahead funbox on a 60-second test.",
    settings: {
      type: "funbox",
      parameters: { funbox: "read_ahead", mode: "time", mode2: 60 },
      requirements: {
        wpm: { min: 100 },
        time: { min: 60 },
        funbox: { exact: ["read_ahead"] },
        config: { tapeMode: "off" },
      },
    },
  },
  iCanSeeTheFuture: {
    display: "I can see the future",
    category: "funbox",
    description:
      "Achieve 100+ WPM using the read ahead hard funbox on a 60-second test.",
    settings: {
      type: "funbox",
      parameters: { funbox: "read_ahead_hard", mode: "time", mode2: 60 },
      requirements: {
        wpm: { min: 100 },
        time: { min: 60 },
        funbox: { exact: ["read_ahead_hard"] },
        config: { tapeMode: "off" },
      },
    },
  },
  whatAreWordsAtThisPoint: {
    display: "What are words at this point?",
    category: "funbox",
    description:
      "Complete at least a one-hour test using the gibberish funbox mode.",
    settings: {
      type: "funbox",
      parameters: { funbox: "gibberish", mode: "time", mode2: 3600 },
      requirements: { time: { min: 60 }, funbox: { exact: ["gibberish"] } },
    },
  },
  specials: {
    display: "Specials",
    category: "funbox",
    description:
      "Complete at least a one-hour test using the specials funbox mode.",
    settings: {
      type: "funbox",
      parameters: { funbox: "specials", mode: "time", mode2: 3600 },
      requirements: { time: { min: 60 }, funbox: { exact: ["specials"] } },
    },
  },
  aeiou: {
    display: "Aeiou.",
    category: "funbox",
    description: "Complete at least a one-hour test using the tts funbox mode.",
    settings: {
      type: "funbox",
      parameters: { funbox: "tts", mode: "time", mode2: 3600 },
      requirements: { time: { min: 60 }, funbox: { exact: ["tts"] } },
    },
  },
  asciiWarrior: {
    display: "ASCII warrior",
    category: "funbox",
    description:
      "Complete at least a one-hour test using the ascii funbox mode.",
    settings: {
      type: "funbox",
      parameters: { funbox: "ascii", mode: "time", mode2: 3600 },
      requirements: { time: { min: 60 }, funbox: { exact: ["ascii"] } },
    },
  },
  iKiNdAlIkEhOwInEfFiCiEnTqWeRtYiS: {
    display: "i KINda LikE HoW inEFFICIeNt QwErtY Is.",
    category: "funbox",
    description:
      "Complete at least a one-hour test using the randomcase funbox mode.",
    settings: {
      type: "funbox",
      parameters: { funbox: "sPoNgEcAsE", mode: "time", mode2: 3600 },
      requirements: { time: { min: 60 }, funbox: { exact: ["sPoNgEcAsE"] } },
    },
  },
  oneNauseousMonkey: {
    display: "One Nauseous Typist",
    category: "funbox",
    description:
      "Complete at least a one-hour test using the nausea funbox mode.",
    settings: {
      type: "funbox",
      parameters: { funbox: "nausea", mode: "time", mode2: 3600 },
      requirements: { time: { min: 60 }, funbox: { exact: ["nausea"] } },
    },
  },
} satisfies Partial<Record<ChallengeName, Omit<Challenge, "name">>>;
