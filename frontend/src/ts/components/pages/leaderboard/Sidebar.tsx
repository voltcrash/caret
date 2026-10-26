import { ValidModeRule } from "@caret/schemas/configuration";
import { Language } from "@caret/schemas/languages";
import { Mode } from "@caret/schemas/shared";
import { Accessor, For, JSXElement, Show } from "solid-js";

import { Selection } from "../../../states/leaderboard-selection";
import { FaSolidIcon } from "../../../types/font-awesome";
import { Button } from "../../common/Button";

type GroupItem<T> = { id: T; text: string; icon: FaSolidIcon };

type LanguagesByModeByMode2 = Partial<Record<Mode, Record<string, Language[]>>>;

type ValidLeaderboards = {
  allTime: LanguagesByModeByMode2;
  weekly: LanguagesByModeByMode2;
  daily: LanguagesByModeByMode2;
};

type ModeSelect = Pick<Selection, "mode" | "mode2">;

export function Sidebar(props: {
  selection: Accessor<Selection>;
  onSelect: (selection: Selection) => void;
  validModeRules: ValidModeRule[];
}): JSXElement {
  const updateSelection = (patch: Partial<Selection>) => {
    props.onSelect(
      normalizeSelection(
        { ...props.selection(), ...patch } as Selection,
        getValidLeaderboards(props.validModeRules),
      ),
    );
  };

  const selectType = (type: Selection["type"]) => {
    updateSelection({ type });
  };

  const selectMode = (value: ModeSelect) => {
    updateSelection({ mode: value.mode, mode2: value.mode2 });
  };

  const selectLanguage = (language: Language) => {
    updateSelection({ language });
  };
  return (
    <>
      <Group
        selected={props.selection().type}
        onSelect={selectType}
        items={[
          {
            id: "allTime",
            text: "all-time english",
            icon: "fa-globe-americas",
          },
          { id: "weekly", text: "weekly xp", icon: "fa-calendar-day" },
          { id: "daily", text: "daily", icon: "fa-sun" },
        ]}
      />
      <Show when={props.selection().type !== "weekly"}>
        <Group
          selected={{
            mode: props.selection().mode,
            mode2: props.selection().mode2,
          }}
          onSelect={selectMode}
          items={getModeButtons(
            getValidLeaderboards(props.validModeRules)[props.selection().type],
            props.selection().language,
          )}
        />
      </Show>
      <Show when={props.selection().type === "daily"}>
        <Group
          selected={props.selection().language}
          onSelect={selectLanguage}
          items={getLanguageButtons(
            getValidLeaderboards(props.validModeRules).daily,
            props.selection().mode,
            props.selection().mode2,
          )}
        />
      </Show>
    </>
  );
}

function Group<T>(props: {
  items: GroupItem<T>[];
  selected: T | undefined;
  onSelect: (selected: T) => void;
}): JSXElement {
  const isEqual = (a: unknown, b: unknown): boolean =>
    typeof a === "object" ? JSON.stringify(a) === JSON.stringify(b) : a === b;

  return (
    <div class="mb-2 flex gap-2 overflow-x-auto overscroll-x-contain rounded-xl bg-sub-alt p-2 lg:mb-4 lg:grid lg:gap-4 lg:overflow-visible lg:p-4">
      <For each={props.items}>
        {(item) => (
          <Button
            onClick={() => props.onSelect(item.id)}
            fa={{ icon: item.icon }}
            text={item.text}
            class="shrink-0 justify-start px-[0.75em] whitespace-nowrap max-lg:min-h-11"
            active={isEqual(item.id, props.selected)}
          />
        )}
      </For>
    </div>
  );
}

function normalizeSelection(
  draft: Selection,
  valid: ValidLeaderboards,
): Selection {
  if (draft.type === "weekly") {
    return {
      ...draft,
      mode: undefined,
      mode2: undefined,
      language: undefined,
      previous: false,
    };
  }

  let { mode, mode2, language } = draft;
  const validModes = valid[draft.type];

  if (validModes === undefined) throw new Error("no valid leaderboards");

  if (mode === null || validModes[mode] === undefined) {
    const firstMode = Object.keys(validModes).sort()[0] as Mode | undefined;
    if (!firstMode) {
      throw new Error(`No valid mode for type ${draft.type}`);
    }
    mode = firstMode;
  }

  const validMode2 = validModes[mode] as Record<string, Language[]>;

  if (mode2 === null || validMode2[mode2] === undefined) {
    const firstMode2 = Object.keys(validMode2).sort(
      (a, b) => parseInt(a) - parseInt(b),
    )[0];
    if (firstMode2 === undefined) {
      throw new Error(`No valid mode2 for ${draft.type}:${mode}`);
    }
    mode2 = firstMode2;
  }

  const supportedLanguages = validMode2[mode2];
  if (!supportedLanguages || supportedLanguages.length === 0) {
    throw new Error(`Invalid leaderboard config for ${mode}:${mode2}`);
  }

  if (!language || !supportedLanguages.includes(language)) {
    language = supportedLanguages.sort()[0] as Language;
  }

  return { ...draft, mode, mode2, language };
}

function getModeButtons(
  valid: LanguagesByModeByMode2,
  language?: Language,
): GroupItem<ModeSelect>[] {
  const modes = Object.entries(valid).flatMap(([mode, mode2List]) =>
    Object.entries(mode2List)
      .filter(
        ([_, languages]) =>
          language === undefined || languages.includes(language),
      )
      .flatMap(([mode2]) => ({
        id: { mode, mode2 },
        text: `${mode} ${mode2}`,
        icon: mode === "time" ? "fa-clock" : "fa-align-left",
      })),
  );

  return modes as GroupItem<ModeSelect>[];
}

function getLanguageButtons(
  valid: LanguagesByModeByMode2,
  mode: Mode | undefined,
  mode2: string | undefined,
): GroupItem<Language>[] {
  if (mode === undefined || mode2 === undefined) return [];

  return (valid[mode]?.[mode2] ?? []).map((language) => ({
    id: language,
    text: language,
    icon: "fa-globe",
  }));
}
function getValidLeaderboards(
  validModeRules: ValidModeRule[],
): ValidLeaderboards {
  //a rule can contain multiple values. create a flat list out of them
  const dailyRules = validModeRules.flatMap((rule) => {
    const languages = convertRuleOption(rule.language) as Language[];
    const mode2List = convertRuleOption(rule.mode2);

    return mode2List.map((mode2) => ({
      mode: rule.mode as Mode,
      mode2,
      languages,
    }));
  });

  return {
    allTime: {
      time: {
        "15": ["english"],
        "60": ["english"],
      },
    },
    weekly: {},
    daily: dailyRules.reduce<
      Partial<Record<Mode, Record<string /*mode2*/, Language[]>>>
    >((acc, { mode, mode2, languages }) => {
      let modes = acc[mode];
      if (modes === undefined) {
        modes = {};
        acc[mode] = modes;
      }

      let modes2 = modes[mode2];
      if (modes2 === undefined) {
        modes2 = [];
        modes[mode2] = modes2;
      }

      modes2.push(...languages);
      return acc;
    }, {}),
  };
}

function convertRuleOption(rule: string): string[] {
  return rule.startsWith("(") ? rule.slice(1, -1).split("|") : [rule];
}
