import type { ChallengeName } from "@oxytype/schemas/challenges";
import type { Challenge } from "../types";

export const scriptChallenges = {
  inAGalaxyFarFarAway: {
    display: "In a galaxy far, far away",
    category: "script",
    description:
      "Type out the entire Star Wars Episode 4 script with punctuation while watching the movie simultaneously.",
    settings: {
      type: "script",
      parameters: { script: "episode4.txt", funboxes: ["space_balls"] },
      requirements: { config: { tapeMode: "off" } },
    },
  },
  beepBoop: {
    display: "Beep Boop",
    category: "script",
    description:
      "Type the beepboop script with 100% accuracy and at least 45 WPM.",
    settings: {
      type: "script",
      message: "Minimum 45 WPM and 100% accuracy required.",
      parameters: { script: "beepboop.txt", funboxes: ["nospace"] },
      requirements: {
        wpm: { min: 45 },
        acc: { min: 100 },
        funbox: { exact: ["nospace"] },
      },
    },
  },
  whosYourDaddy: {
    display: "Who's your daddy?",
    category: "script",
    description:
      "Type out the entire Star Wars Episode 5 script with punctuation while watching the movie simultaneously.",
    settings: {
      type: "script",
      parameters: { script: "episode5.txt", funboxes: ["space_balls"] },
      requirements: { config: { tapeMode: "off" } },
    },
  },
  itsATrap: {
    display: "It's a trap!!",
    category: "script",
    description:
      "Type out the entire Star Wars Episode 6 script with punctuation while watching the movie simultaneously.",
    settings: {
      type: "script",
      parameters: { script: "episode6.txt", funboxes: ["space_balls"] },
      requirements: { config: { tapeMode: "off" } },
    },
  },
  jolly: {
    display: "Jolly",
    category: "script",
    description: "Type the Jolly script with a minimum of 70 wpm.",
    settings: {
      type: "script",
      message: "Minimum 70wpm required.",
      parameters: { script: "jolly.txt" },
      requirements: { wpm: { min: 70 } },
    },
  },
  gottaCatchEmAll: {
    display: "Gotta catch 'em all",
    category: "script",
    description: "Type out the names of all Pokemon.",
    settings: {
      type: "script",
      parameters: { script: "pokemon.txt" },
    },
  },
  rapGod: {
    display: "Rap God",
    category: "script",
    description:
      "Type out the lyrics of Eminem's Rap God at a minimum of 85 WPM and 90% accuracy, including punctuation.",
    settings: {
      type: "script",
      message: "Minimum 85wpm and 90% accuracy required.",
      parameters: { script: "rapgod.txt" },
      requirements: { wpm: { min: 85 }, acc: { min: 90 }, afk: { max: 5 } },
    },
  },
  navySeal: {
    display: "Navy Seal",
    category: "script",
    description:
      "Type out the Navy Seal copy pasta with 100% accuracy and minimum 60 WPM.",
    settings: {
      type: "script",
      message: "Minimum 60wpm and 100% accuracy required.",
      parameters: { script: "navyseal.txt" },
      requirements: { wpm: { min: 60 }, acc: { exact: 100 }, afk: { max: 5 } },
    },
  },
  littleChef: {
    display: "Little Chef",
    category: "script",
    description:
      "Type out the entire Ratatouille script while watching the movie simultaneously.",
    settings: { type: "script", parameters: { script: "littlechef.txt" } },
  },
  crosstalk: {
    display: "(CROSSTALK)",
    category: "script",
    description:
      "Type out the entire transcript of the first 2020 Presidential Debate.",
    settings: { type: "script", parameters: { script: "crosstalk.txt" } },
  },
  bees: {
    display: "Bees!!!",
    category: "script",
    description:
      "Type out the entire Bee Movie script while watching the movie simultaneously.",
    settings: { type: "script", parameters: { script: "bees.txt" } },
  },
  getOffMySwamp: {
    display: "Get off my swamp",
    category: "script",
    description:
      "Type out the entire Shrek script with punctuation while watching the movie simultaneously.",
    settings: { type: "script", parameters: { script: "shrek.txt" } },
  },
} satisfies Partial<Record<ChallengeName, Omit<Challenge, "name">>>;
