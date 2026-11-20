import { JSXElement } from "solid-js";

import { Link } from "#shared/components/common/Link.tsx";
import { getIsScreenshotting } from "#shared/states/core.ts";
import { cn } from "#shared/utils/cn.ts";

import { resultState } from "../../state/result";

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
