import { createCustomTextController } from "./custom-text/createCustomTextController";
import { CustomTextEditor } from "./custom-text/CustomTextEditor";
import { CustomTextSettings } from "./custom-text/CustomTextSettings";

export { type CustomTextIncomingData } from "./custom-text/types";

import { JSXElement } from "solid-js";

import { AnimatedModal } from "../common/AnimatedModal";
import { Separator } from "../common/Separator";
import { CustomGeneratorModal } from "./CustomGeneratorModal";
import { SaveCustomTextModal } from "./SaveCustomTextModal";
import { SavedTextsModal } from "./SavedTextsModal";
import { WordFilterModal } from "./WordFilterModal";

export function CustomTextModal(): JSXElement {
  const controller = createCustomTextController();
  const { setIncomingChainedData, textToSave, form, beforeShow, afterShow } =
    controller;
  return (
    <>
      <AnimatedModal
        id="CustomText"
        modalClass="max-w-[1200px] lg:grid-cols-[auto_20rem] grid-cols-1 h-min"
        beforeShow={beforeShow}
        afterShow={afterShow}
      >
        <form
          class="contents"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <Separator class="row-start-2 block lg:hidden" />
          <CustomTextEditor controller={controller} />

          {/* Settings sidebar — stacks below the textarea on small screens, column 2 on large screens */}
          <CustomTextSettings controller={controller} />
        </form>
      </AnimatedModal>
      <SaveCustomTextModal textToSave={textToSave} />
      <SavedTextsModal setChainedData={setIncomingChainedData} />
      <WordFilterModal setChainedData={setIncomingChainedData} />
      <CustomGeneratorModal setChainedData={setIncomingChainedData} />
    </>
  );
}
