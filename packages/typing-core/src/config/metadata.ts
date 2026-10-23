// Temporary oracle-only rules; production metadata lives outside the legacy engine.
import { checkCompatibility } from "@oxytype/funbox";
import { canSetFunboxWithConfig } from "./funbox-validation";
import {
  sharedConfigMetadata as metadata,
  type SharedConfigMetadataObject,
} from "@oxytype/web-shared/config/metadata";
export * from "@oxytype/web-shared/config/metadata";
export const sharedConfigMetadata: SharedConfigMetadataObject = {
  ...metadata,
  funbox: {
    ...metadata.funbox,
    blockedReason: ({ value, currentConfig }) => {
      if (!checkCompatibility(value)) {
        const names = value.join(", ");
        return `${names.charAt(0).toUpperCase()}${names.slice(1)} is an invalid combination of funboxes`;
      }
      const blocked = value.find(
        (funbox) => !canSetFunboxWithConfig(funbox, currentConfig).ok,
      );
      return blocked === undefined
        ? undefined
        : `"${blocked}" cannot be enabled with the current config`;
    },
  },
};
