import type { Challenge } from "../types";
import { ChallengeName } from "@oxytype/schemas/challenges";

export const challenges: Record<ChallengeName, Omit<Challenge, "name">> = {
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
};
