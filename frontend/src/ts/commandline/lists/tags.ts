import { createAccountOwned } from "#app/account-scope.ts";
import { appObject } from "#app/state.ts";
import {
  clearActiveTags,
  getTag,
  getTags,
  toggleTagActive,
} from "../../../data/collections/tags";
import { peekConfig } from "../../config/store";
import { reloadPaceCaret } from "../../typing-host";
import { isAuthenticated } from "../../states/core";
import { Command, CommandsSubgroup } from "../types";
import { showAddTagModal } from "../../components/modals/AddTagModal";

const getSubgroup = createAccountOwned<CommandsSubgroup>(() => ({
  title: "Tags...",
  list: [],
  beforeList: (): void => {
    update();
  },
}));

const commands = appObject(
  createAccountOwned<Command[]>(() => [
    {
      id: "changeTags",
      display: "Tags...",
      icon: "fa-tag",
      subgroup: getSubgroup(),
      available: (): boolean => {
        return isAuthenticated();
      },
    },
  ]),
  true,
);

function update(): void {
  const tags = getTags();
  getSubgroup().list = [];

  if (tags.length > 0) {
    getSubgroup().list.push({
      id: "clearTags",
      display: `Clear tags`,
      icon: "fa-times",
      sticky: true,
      exec: async (): Promise<void> => {
        await clearActiveTags();
        if (
          peekConfig().paceCaret === "average" ||
          peekConfig().paceCaret === "tagPb" ||
          peekConfig().paceCaret === "daily"
        ) {
          await reloadPaceCaret();
        }
      },
    });

    for (const tag of tags) {
      getSubgroup().list.push({
        id: `toggleTag${tag._id}`,
        display: tag.name,
        sticky: true,
        active: () => {
          return getTag(tag._id)?.active ?? false;
        },
        exec: async (): Promise<void> => {
          await toggleTagActive({ tagId: tag._id });

          if (
            peekConfig().paceCaret === "average" ||
            peekConfig().paceCaret === "tagPb" ||
            peekConfig().paceCaret === "daily"
          ) {
            await reloadPaceCaret();
          }
        },
      });
    }
  }
  getSubgroup().list.push({
    id: "createTag",
    display: "Create tag",
    icon: "fa-plus",
    shouldFocusTestUI: false,
    opensModal: true,
    exec: (): void => {
      showAddTagModal();
    },
  });
}

export default commands;
