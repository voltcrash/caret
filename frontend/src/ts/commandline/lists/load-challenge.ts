import { getChallenges } from "@oxytype/challenges";
import * as ChallengeController from "../../controllers/challenge-controller";
import { navigate } from "../../navigation/navigation";
import * as TestLogic from "../../../features/typing/runtime/test-logic";
import { capitalizeFirstLetterOfEachWord } from "../../utils/strings";
import { Command, CommandsSubgroup } from "../types";

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
