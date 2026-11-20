import type { JSXElement } from "solid-js";

import { useTypingCommands } from "../features/typing/commands";
import { Commandline } from "../ts/components/modals/Commandline";

/** The palette with the commands features contribute while it is mounted. */
export function CommandlineHost(): JSXElement {
  useTypingCommands();
  return <Commandline />;
}
