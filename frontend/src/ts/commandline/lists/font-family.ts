import { openFilePicker } from "../../components/common/FilePicker";
import { FontNameSchema } from "@oxytype/schemas/fonts";
import { Command, withValidation } from "../types";
import { buildCommandForConfigKey } from "../util";
import FileStorage from "../../utils/file-storage";

import { showNoticeNotification } from "../../states/notifications";
import { getMutableConfig } from "../../config/store";
import { setConfig } from "../../config/setters";
import { applyFontFamily } from "../../ui";

const fromMeta = buildCommandForConfigKey("fontFamily");

if (fromMeta.subgroup) {
  fromMeta.subgroup.list.push({
    id: "customFont",
    display: "Custom font...",
    icon: "fa-font",
    alias: "custom font options",
    subgroup: {
      title: "Custom font...",
      list: [
        withValidation({
          id: "customFontName",
          display: "Custom name...",
          icon: "fa-font",
          alias: "custom font name",
          input: true,
          validation: {
            schema: FontNameSchema,
          },
          defaultValue: (): string => {
            return getMutableConfig().fontFamily.replace(/_/g, " ");
          },
          exec: ({ input }): void => {
            if (input === undefined || input === "") return;
            const fontName = input.replaceAll(/ /g, "_");
            setConfig("fontFamily", fontName);
          },
        }),
        {
          id: "customLocalFont",
          display: "Local font...",
          icon: "fa-file-import fa-fw",
          alias: "upload font",
          available: async (): Promise<boolean> => {
            return !(await FileStorage.hasFile("LocalFontFamilyFile"));
          },
          exec: async (): Promise<void> => {
            openFilePicker({
              accept: "font/woff,font/woff2,font/ttf,font/otf",
              onFile: async (file, cleanup) => {
                if (!file) {
                  cleanup();
                  return;
                }

                // check type
                if (
                  !/font\/(woff|woff2|ttf|otf)/.exec(file.type) &&
                  !/\.(woff|woff2|ttf|otf)$/i.exec(file.name)
                ) {
                  showNoticeNotification(
                    "Unsupported font format, must be woff, woff2, ttf or otf.",
                  );
                  cleanup();
                  return;
                }

                const reader = new FileReader();
                reader.onload = async (readerEvent) => {
                  const dataUrl = readerEvent.target?.result as string;
                  try {
                    await FileStorage.storeFile("LocalFontFamilyFile", dataUrl);
                    await applyFontFamily();
                  } catch (e) {
                    showNoticeNotification(
                      `Error uploading font: ${(e as Error).message}`,
                    );
                  }
                  cleanup();
                };
                reader.onerror = cleanup;
                reader.readAsDataURL(file);
              },
            });
          },
        },
        {
          id: "removeLocalFont",
          display: "Remove local font",
          icon: "fa-trash",
          alias: "remove font",
          available: async (): Promise<boolean> => {
            return await FileStorage.hasFile("LocalFontFamilyFile");
          },
          exec: async (): Promise<void> => {
            try {
              await FileStorage.deleteFile("LocalFontFamilyFile");
              await applyFontFamily();
            } catch (e) {
              showNoticeNotification(
                `Error removing font: ${(e as Error).message}`,
              );
            }
          },
        },
      ],
    },
  });
}

const commands: Command[] = [fromMeta];

export default commands;
