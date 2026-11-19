import { getAllFunboxes } from "@caret/funbox";
import { For, JSXElement, type JSX } from "solid-js";

import { Button } from "../../../../ts/components/common/Button";
// import { canSetFunboxWithConfig } from "../../../../ts/config/funbox-validation";
import { configMetadata } from "../../../../ts/config/metadata";
import { toggleFunbox } from "../../../../ts/config/setters";
import { getConfig } from "../../../../ts/config/store";
import {
  checkCompatibility,
  enginePolicyReady,
} from "../../../typing/engine/policy.client";
import { getActiveFunboxNames } from "../../../typing/runtime/funbox/list";
import { SearchableSetting } from "../SearchableSetting";

export function Funbox(): JSXElement {
  return (
    <SearchableSetting
      key="funbox"
      title="funbox"
      description={configMetadata.funbox.description}
      fa={configMetadata.funbox.fa}
      fullWidthInputs={
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(13.5rem,1fr))]">
          <For each={getAllFunboxes()}>
            {(funbox) => {
              const active = () => getConfig.funbox.includes(funbox.name);

              const disabled = () => {
                if (!enginePolicyReady()) return true;
                if (active()) return false;
                const incompatible = !checkCompatibility(
                  getActiveFunboxNames(),
                  funbox.name,
                );
                return incompatible;
                // const configIncompatible = !canSetFunboxWithConfig(
                //   funbox.name,
                //   getConfig,
                // ).ok;
                // return incompatible || configIncompatible;
              };

              const style = (): JSX.CSSProperties | undefined => {
                if (funbox.name === "mirror") {
                  return {
                    transform: "scaleX(-1)",
                  };
                }
                if (funbox.name === "upside_down") {
                  return {
                    transform: "rotate(180deg)",
                    "z-index": 2,
                  };
                }
                return undefined;
              };

              const text = () => {
                if (funbox.name === "underscore_spaces") {
                  return "underscore_spaces";
                }
                return funbox.name.replace(/_/g, " ");
              };

              return (
                <div style={style()}>
                  <Button
                    active={active()}
                    onClick={() => {
                      toggleFunbox(funbox.name);
                    }}
                    disabled={disabled()}
                    balloon={{
                      text: funbox.description,
                      length: "xlarge",
                    }}
                    class="w-full"
                  >
                    {text()}
                  </Button>
                </div>
              );
            }}
          </For>
        </div>
      }
    />
  );
}
