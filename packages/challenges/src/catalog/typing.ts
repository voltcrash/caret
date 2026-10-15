import type { ChallengeName } from "@oxytype/schemas/challenges";
import type { Challenge } from "../types";

export const typingChallenges = {
  bigramSalad: {
    display: "Bigram Salad",
    category: "speed",
    description:
      "Get 100 WPM on a randomized, 100-word custom test with the words list: to of in it is as at be we he so on an or do if up by my go.",
    settings: {
      type: "customText",
      parameters: {
        text: "to of in it is as at be we he so on an or do if up by my go",
        mode: "random",
        limit: 100,
        limitMode: "word",
        isPipeDelimiter: false,
      },
      requirements: { wpm: { min: 100 } },
    },
  },
  antidiseWhat: {
    display: "Antidise-what?",
    category: "script",
    description: "Get at least 200 wpm typing antidisestablishmentarianism.",
    settings: {
      type: "customText",
      parameters: {
        text: "antidisestablishmentarianism",
        mode: "repeat",
        limit: 1,
        limitMode: "word",
        isPipeDelimiter: false,
      },
      requirements: { wpm: { min: 200 } },
    },
  },
  developd: {
    display: "Develop'd",
    category: "script",
    description: "Type develop one thousand times.",
    settings: {
      type: "customText",
      parameters: {
        text: "develop",
        mode: "repeat",
        limit: 1000,
        limitMode: "word",
        isPipeDelimiter: false,
      },
    },
  },
  slowAndSteady: {
    display: "Slow and Steady",
    category: "speed",
    description:
      "Complete a 5-minute test with exactly 60 WPM without using the live WPM or pace caret.",
    settings: {
      type: "customTime",
      parameters: { time: 300 },
      requirements: {
        wpm: { exact: 60 },
        config: { liveSpeedStyle: "off", paceCaret: "off" },
      },
    },
  },
  speedSpacer: {
    display: "Speed Spacer",
    category: "speed",
    description:
      "Get 100 wpm on a randomised custom test with the input: a b c d e f g h i j k l m n o p q r s t u v w x y z (the alphabet) and a word count of 100.",
    settings: {
      type: "customText",
      parameters: {
        text: "a b c d e f g h i j k l m n o p q r s t u v w x y z",
        mode: "random",
        limit: 100,
        limitMode: "word",
        isPipeDelimiter: false,
      },
      requirements: { wpm: { min: 100 } },
    },
  },
  iveGotThePower: {
    display: "I've got the POWER",
    category: "speed",
    description: "Get 400 WPM while typing power 10 times.",
    settings: {
      type: "customText",
      parameters: {
        text: "power",
        mode: "repeat",
        limit: 10,
        limitMode: "word",
        isPipeDelimiter: false,
      },
      requirements: { wpm: { min: 400 } },
    },
  },
  accuracyExpert: {
    display: "Accuracy Expert",
    category: "accuracy",
    description: "Complete a 10-minute Master mode test.",
    settings: {
      type: "accuracy",
      message: "Minimum 60wpm and 100% accuracy required.",
      requirements: {
        wpm: { min: 60 },
        acc: { exact: 100 },
        afk: { max: 5 },
        time: { min: 600 },
      },
    },
  },
  accuracyMaster: {
    display: "Accuracy Master",
    category: "accuracy",
    description: "Complete a 20-minute Master mode test.",
    settings: {
      type: "accuracy",
      message: "Minimum 60wpm and 100% accuracy required.",
      requirements: {
        wpm: { min: 60 },
        acc: { exact: 100 },
        afk: { max: 5 },
        time: { min: 1200 },
      },
    },
  },
  accuracyGod: {
    display: "Accuracy God",
    category: "accuracy",
    description: "Complete a 30-minute Master mode test.",
    settings: {
      type: "accuracy",
      message: "Minimum 60wpm and 100% accuracy required.",
      requirements: {
        wpm: { min: 60 },
        acc: { exact: 100 },
        afk: { max: 5 },
        time: { min: 1800 },
      },
    },
  },
} satisfies Partial<Record<ChallengeName, Omit<Challenge, "name">>>;
