import { JSXElement } from "solid-js";

import { Link } from "../../../../ts/components/common/Link";
import { getIsScreenshotting } from "../../../../ts/states/core";
import { resultState } from "../../../../ts/states/result";
import { cn } from "../../../../ts/utils/cn";

export function ResultLoginTip(): JSXElement {
  return (
    <div
      class={cn(
        "loginTip col-[1/-1] text-center text-text",
        (!resultState.loginTip || getIsScreenshotting()) && "hidden",
      )}
    >
      <Link href="/login">Sign in</Link> to save your result
    </div>
  );
}
