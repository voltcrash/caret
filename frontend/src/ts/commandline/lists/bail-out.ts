import { getMutableConfig } from "../../config/store";
import { getCustomTextIndicator } from "../../states/core";
import * as CustomText from "../../../features/typing/runtime/custom-text";
import { setBailedOut } from "../../states/test";
import * as TestLogic from "../../../features/typing/runtime/test-logic";
import { Command, CommandsSubgroup } from "../types";

function canBailOut(): boolean {
  return (
    (getMutableConfig().mode === "custom" &&
      getCustomTextIndicator()?.isLong === true) ||
    (getMutableConfig().mode === "custom" &&
      (CustomText.getLimitMode() === "word" ||
        CustomText.getLimitMode() === "section") &&
      (CustomText.getLimit().value >= 5000 ||
        CustomText.getLimit().value === 0)) ||
    (getMutableConfig().mode === "custom" &&
      CustomText.getLimitMode() === "time" &&
      (CustomText.getLimitValue() >= 3600 ||
        CustomText.getLimitValue() === 0)) ||
    (getMutableConfig().mode === "words" && getMutableConfig().words >= 5000) ||
    getMutableConfig().words === 0 ||
    (getMutableConfig().mode === "time" &&
      (getMutableConfig().time >= 3600 || getMutableConfig().time === 0)) ||
    getMutableConfig().mode === "zen"
  );
}

const subgroup: CommandsSubgroup = {
  title: "Are you sure...",
  list: [
    {
      id: "bailOutNo",
      display: "Nevermind",
      available: (): boolean => {
        return canBailOut();
      },
    },
    {
      id: "bailOutForSure",
      display: "Yes, I am sure",
      exec: (): void => {
        setBailedOut(true);
        void TestLogic.finish();
      },
      available: (): boolean => {
        return canBailOut();
      },
    },
  ],
};

const commands: Command[] = [
  {
    id: "bailOut",
    display: "Bail out...",
    icon: "fa-running",
    subgroup,
    visible: false,
    available: (): boolean => {
      return canBailOut();
    },
  },
];

export default commands;
