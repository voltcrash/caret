import { getChallenges } from "@caret/challenges";
import * as ChallengeController from "../runtime/challenge-controller";
import { navigate } from "../../../app/navigate";
import * as TestLogic from "../runtime/test/logic";
import { capitalizeFirstLetterOfEachWord } from "../../../ts/utils/strings";
import { Command, CommandsSubgroup } from "../../../ts/commandline/types";

const subgroup: CommandsSubgroup = {
  title: "Load challenge...",
  list: getChallenges()
    .filter((it) => it.settings !== undefined)
    .map((challenge) => ({
      id: `loadChallenge${capitalizeFirstLetterOfEachWord(challenge.name)}`,
      display: challenge.display,
      exec: async (): Promise<void> => {
        await navigate("/");
        await ChallengeController.setup(challenge.name);
        void TestLogic.restart({
          nosave: true,
        });
      },
    })),
};

const commands: Command[] = [
  {
    id: "loadChallenge",
    display: "Load challenge...",
    icon: "fa-award",
    subgroup,
  },
];

export default commands;
