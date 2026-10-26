import { ConfigKey } from "@caret/schemas/configs";
import { createMemo, createSignal, JSXElement, Show } from "solid-js";

import { setConfig } from "../../../config/setters";
import { getConfig } from "../../../config/store";
import { getDefaultConfig } from "../../../constants/default-config";
import { showErrorNotification } from "../../../states/notifications";
import { Button } from "../../common/Button";

const defaults = getDefaultConfig();

export function ResetSetting(props: {
  keys: ConfigKey[];
  hasCustomChanges?: boolean;
  onReset?: () => void | Promise<void>;
}): JSXElement {
  const [resetting, setResetting] = createSignal(false);
  // Config values are primitives or arrays. Compare array contents, not refs.
  const isDefault = (key: ConfigKey): boolean =>
    JSON.stringify(getConfig[key]) === JSON.stringify(defaults[key]);
  const modified = createMemo(
    () =>
      props.hasCustomChanges === true ||
      props.keys.some((key) => !isDefault(key)),
  );

  const reset = async (): Promise<void> => {
    setResetting(true);
    try {
      const values = getDefaultConfig();
      // Check each value at the time of setting it: earlier setters can change
      // related values. Composite rows put their controlling mode last.
      for (const key of props.keys) {
        if (!isDefault(key) && !setConfig(key, values[key])) return;
      }
      await props.onReset?.();
    } catch (error) {
      showErrorNotification("Failed to reset setting", { error });
    } finally {
      setResetting(false);
    }
  };

  return (
    <Show when={modified()}>
      <Button
        variant="text"
        class="-my-2 shrink-0 p-2 hover:bg-sub-alt"
        fa={{ icon: "fa-rotate-left" }}
        balloon={{ text: "Reset to default", position: "up" }}
        disabled={resetting()}
        onClick={() => void reset()}
      />
    </Show>
  );
}
