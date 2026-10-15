import type { ChallengeName } from "@oxytype/schemas/challenges";
import type { Challenge } from "../types";

export const otherChallenges = {
  "69": {
    display: "6969696969",
    category: "other",
    description:
      "Complete a 69-second test and achieve 69 WPM, 69 raw, 69% accuracy, and 69% consistency.",
    settings: {
      type: "customTime",
      message:
        "You need to achieve 69 wpm, 69 raw, 69% accuracy and 69% consistency.",
      parameters: { time: 69 },
      requirements: {
        wpm: { exact: 69 },
        raw: { exact: 69 },
        acc: { exact: 69 },
        con: { exact: 69 },
      },
    },
  },
  thumbWarrior: {
    display: "Thumb warrior",
    category: "other",
    description: "Complete a one-hour test using only your thumbs.",
    settings: { type: "customTime", parameters: { time: 3600 } },
  },
  mouseWarrior: {
    display: "Mouse warrior",
    category: "other",
    description:
      "Complete a one-hour test using only the on-screen keyboard. Funbox modes are not allowed.",
    settings: { type: "customTime", parameters: { time: 3600 } },
  },
  mobileWarrior: {
    display: "Mobile warrior",
    category: "other",
    description: "Complete a one-hour test on mobile.",
    settings: { type: "customTime", parameters: { time: 3600 } },
  },
  upsideDown: {
    display: "uʍop ǝpᴉsdn",
    category: "other",
    description:
      "Achieve at least 60 WPM on a one-minute test with your keyboard upside down.",
    settings: { type: "customTime", parameters: { time: 60 } },
  },
  oneArmedBandit: {
    display: "One armed bandit",
    category: "other",
    description:
      "Complete a one-hour or 10k words test (whichever comes sooner, using an external timer) using a one-handed words list (either left or right) for your layout.",
    settings: { type: "customWords", parameters: { words: 10000 } },
  },
  englishMaster: {
    display: "English master",
    category: "other",
    description:
      "Complete a one-hour test using English 10k language with punctuation and numbers enabled.",
    settings: {
      type: "customTime",
      parameters: { time: 3600 },
      requirements: {
        time: { min: 3600 },
        config: { language: "english_10k", punctuation: true, numbers: true },
      },
    },
  },
  feetWarrior: {
    display: "Feet warrior",
    category: "other",
    description: "Complete a one-hour test using your feet. Don't ask me why.",
    settings: { type: "customTime", parameters: { time: 3600 } },
  },
  wingdings: {
    display: "Ten Words of Pain",
    category: "other",
    description:
      "Complete a 10-word Master mode test using the Wingdings custom font.",
    settings: {
      type: "other",
      message:
        "Complete a 10-word Master mode test using the Wingdings custom font. No keymap allowed. Minimum 60 WPM and 100% accuracy required.",
      requirements: { acc: { exact: 100 } },
    },
  },
} satisfies Partial<Record<ChallengeName, Omit<Challenge, "name">>>;
