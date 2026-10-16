import type { JSXElement } from "solid-js";

import { Fa } from "../../ts/components/common/Fa";

export function ProfileMissing(props: { name: string }): JSXElement {
  return (
    <div class="flex items-baseline gap-2 text-error">
      <Fa icon="fa-times" />
      <span>{`User ${props.name} not found`}</span>
    </div>
  );
}
