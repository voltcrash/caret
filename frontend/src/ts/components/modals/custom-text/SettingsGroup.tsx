import { JSXElement } from "solid-js";

import type { FaSolidIcon } from "../../../types/font-awesome";

import { Fa } from "../../common/Fa";

export function SettingsGroup(props: {
  title: string;
  icon: FaSolidIcon;
  iconClass?: string;
  sub: string;
  children: JSXElement;
}): JSXElement {
  return (
    <div class="grid w-full">
      <div class="flex items-center gap-2 text-sub lowercase">
        <Fa icon={props.icon} fixedWidth class={props.iconClass} />
        {props.title}
      </div>
      <div class="mt-1 mb-2 text-text">{props.sub}</div>
      {props.children}
    </div>
  );
}
