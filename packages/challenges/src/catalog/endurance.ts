import type { ChallengeName } from "@caret/schemas/challenges";
import type { Challenge } from "../types";

export const enduranceChallenges = {
  oneHourWarrior: {
    display: "One Hour Warrior",
    category: "endurance",
    description: "Complete a one-hour test.",
    settings: {
      type: "customTime",
      parameters: { time: 3600 },
      requirements: { time: { min: 3600 } },
    },
  },
  doubleDown: {
    display: "Double Down",
    category: "endurance",
    description: "Complete a two-hour test.",
    settings: {
      type: "customTime",
      parameters: { time: 7200 },
      requirements: { time: { min: 7200 } },
    },
  },
  tripleTrouble: {
    display: "Triple Trouble",
    category: "endurance",
    description: "Complete a three-hour test.",
    settings: {
      type: "customTime",
      parameters: { time: 10800 },
      requirements: { time: { min: 10800 } },
    },
  },
  quad: {
    display: "Quaaaaad",
    category: "endurance",
    description: "Complete a four-hour test.",
    settings: {
      type: "customTime",
      parameters: { time: 14400 },
      requirements: { time: { min: 14400 } },
    },
  },
  "8Ball": {
    display: "8 Ball",
    category: "endurance",
    description: "Complete an eight-hour test.",
    settings: {
      type: "customTime",
      parameters: { time: 28800 },
      requirements: { time: { min: 28800 } },
    },
  },
  theBig12: {
    display: "The Big 12",
    category: "endurance",
    description: "Complete a twelve-hour test.",
    settings: {
      type: "customTime",
      parameters: { time: 43200 },
      requirements: { time: { min: 43200 } },
    },
  },
  "1Day": {
    display: "1 Day",
    category: "endurance",
    description: "Complete a twenty-four-hour test.",
    settings: {
      type: "customTime",
      parameters: { time: 86400 },
      requirements: { time: { min: 86400 } },
    },
  },
} satisfies Partial<Record<ChallengeName, Omit<Challenge, "name">>>;
