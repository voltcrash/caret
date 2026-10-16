import { JSXElement } from "solid-js";

import { useSettingsSectionEffects } from "../../../states/settings-sections";
import { Page } from "../../common/Page";
import { SettingsContent } from "./SettingsContent";

/** Rollback page lifecycle; Start renders SettingsContent from its route. */
export function SettingsPage(): JSXElement {
  useSettingsSectionEffects();
  return (
    <Page id="settings">
      <SettingsContent />
    </Page>
  );
}
