import { ConfigKey, ConfigKeySchema } from "@oxytype/schemas/configs";
import { untrack, createMemo, JSXElement, useContext } from "solid-js";

import {
  registerSearchable,
  settingMatchesSearch,
} from "../../../states/settings-search";
import { SettingsSectionHostContext } from "../../../states/settings-sections";
import { cn } from "../../../utils/cn";
import { createSettingSearchIndex } from "../../../utils/settings-search";
import { Setting, SettingProps } from "../../common/Setting";
import { ResetSetting } from "./ResetSetting";
import { SettingsSectionContext } from "./settings-section-context";
import { SettingsSearchMatch } from "./SettingsSearchMatch";

export type SearchableSettingProps = SettingProps & {
  title: string;
  // extra text (e.g. option labels) the search filter also matches against
  extraSearchKeywords?: string;
  // Composite rows list all their config values, with the controlling mode last.
  resetKeys?: ConfigKey[];
  hasCustomChanges?: boolean;
  onReset?: () => void | Promise<void>;
};

// pull plain text out of a (possibly JSX) description so search can match it.
// solid renders JSX to real DOM nodes/arrays, so we can read their textContent.
function textOf(node: string | JSXElement): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(" ");
  if (node instanceof Node) return node.textContent ?? "";
  return "";
}

// a Setting that hides itself when it doesn't match the active settings search.
// hides (via css) instead of unmounting so typing doesn't remount every setting
// on each keypress; the hidden class stays on the Setting root so the section
// auto-collapse selector keeps working.
export function SearchableSetting(props: SearchableSettingProps): JSXElement {
  const resetKeys = createMemo(() => {
    if (props.resetKeys !== undefined) return props.resetKeys;
    const key = ConfigKeySchema.safeParse(props.key);
    return key.success ? [key.data] : [];
  });
  const index = createMemo(() =>
    createSettingSearchIndex({
      key: props.key,
      title: props.title,
      description: textOf(props.description),
      keywords: props.extraSearchKeywords,
    }),
  );

  const section = useContext(SettingsSectionContext);
  const sections = useContext(SettingsSectionHostContext);
  untrack(() => registerSearchable(index, section));

  return (
    <Setting
      {...props}
      title={<SettingsSearchMatch text={props.title} includeAliases />}
      description={
        typeof props.description === "string" && props.description !== "" ? (
          <SettingsSearchMatch text={props.description} />
        ) : (
          props.description
        )
      }
      titleActions={
        <>
          {props.titleActions}
          <ResetSetting
            keys={resetKeys()}
            hasCustomChanges={props.hasCustomChanges}
            onReset={props.onReset}
          />
        </>
      }
      // deep links can target a setting in a section that isn't selected
      onHighlight={() => {
        if (section !== undefined) sections.select(section);
        props.onHighlight?.();
      }}
      class={cn(props.class, !settingMatchesSearch(index()) && "hidden")}
    />
  );
}
