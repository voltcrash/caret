import { Link } from "@solidjs/meta";
import { createMemo, JSXElement } from "solid-js";

import { caretIconSvg } from "../../../components/brand/caret-icon";
import { Theme } from "../../constants/themes";
import { isDevEnvironment } from "../../utils/env";

export function FavIcon(props: { theme: Theme }): JSXElement {
  const icon = createMemo<string>(() => {
    let { main, bg } = props.theme;
    if (isDevEnvironment()) {
      [main, bg] = [bg, main];
    }
    if (bg === main) {
      bg = "#111";
      main = "#eee";
    }
    return `data:image/svg+xml;base64,${btoa(caretIconSvg({ bg, main }))}`;
  });

  return (
    <Link id="favicon" rel="shortcut icon" type="image/svg+xml" href={icon()} />
  );
}
