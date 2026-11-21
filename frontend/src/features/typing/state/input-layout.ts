import { createAppMemo, createAppOwned } from "#app/application.ts";
import { LayoutObject } from "@caret/schemas/layouts";
import { getConfig } from "#shared/config/store.ts";
import { useResourceWithPromise } from "#shared/hooks/useResourceWithPromise.ts";
import { getLayout } from "#shared/utils/json-data.ts";
import { mirrorLayoutKeys } from "#shared/utils/key-converter.ts";

const getInputLayout = createAppMemo<{
  layout: string;
  isMirrored: boolean;
}>(() => {
  return {
    layout: getConfig.layout === "default" ? "qwerty" : getConfig.layout,
    isMirrored: getConfig.funbox.includes("layout_mirror"),
  };
});

const inputLayout = createAppOwned(() =>
  useResourceWithPromise(getInputLayout, async (layout) => {
    const result = await getLayout(layout.layout);
    if (layout.isMirrored) {
      return mirrorLayoutKeys(result);
    }
    return result;
  }),
);

const inputLayoutObject = (): LayoutObject | undefined => inputLayout()[0]();

/** Resolves once the current input layout has loaded. */
export async function waitForInputLayout(): Promise<LayoutObject> {
  await inputLayout()[1].promise;
  const result = inputLayoutObject();
  if (result === undefined) {
    throw new Error("Failed to load input layout");
  }
  return result;
}
