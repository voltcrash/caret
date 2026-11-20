import { peekConfig } from "#shared/config/store.ts";
import { getCustomTextIndicator } from "#shared/states/core.ts";
import * as CustomText from "../runtime/content/custom-text";
import { setBailedOut } from "#shared/states/test.ts";
import * as TestLogic from "../runtime/test/logic";
import { Command, CommandsSubgroup } from "#shared/commandline/types.ts";

function canBailOut(): boolean {
  return (
    (peekConfig().mode === "custom" &&
      getCustomTextIndicator()?.isLong === true) ||
    (peekConfig().mode === "custom" &&
      (CustomText.getLimitMode() === "word" ||
        CustomText.getLimitMode() === "section") &&
      (CustomText.getLimit().value >= 5000 ||
        CustomText.getLimit().value === 0)) ||
    (peekConfig().mode === "custom" &&
      CustomText.getLimitMode() === "time" &&
      (CustomText.getLimitValue() >= 3600 ||
        CustomText.getLimitValue() === 0)) ||
    (peekConfig().mode === "words" && peekConfig().words >= 5000) ||
    peekConfig().words === 0 ||
    (peekConfig().mode === "time" &&
      (peekConfig().time >= 3600 || peekConfig().time === 0)) ||
    peekConfig().mode === "zen"
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
