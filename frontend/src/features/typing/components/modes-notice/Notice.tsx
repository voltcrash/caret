import { ParentProps, Show } from "solid-js";

import { CommandlineSubgroupKey } from "../../../../ts/commandline/types";
import { Button } from "../../../../ts/components/common/Button";
import { Fa } from "../../../../ts/components/common/Fa";
import { showCommandLineForConfig } from "../../../../ts/states/core";
import { FaSolidIcon } from "../../../../ts/types/font-awesome";
import { cn } from "../../../../ts/utils/cn";
import { OneOf } from "../../../../ts/utils/types";
export function Notice(
  props: {
    when: boolean | undefined;
    icon?: FaSolidIcon;
    class?: string;
  } & OneOf<{ children: ParentProps["children"]; text: string | undefined }> &
    Partial<
      OneOf<{ onClick: () => void; openCommandline: CommandlineSubgroupKey }>
    >,
) {
  const isButton = () =>
    props.onClick !== undefined || props.openCommandline !== undefined;

  const ButtonNotice = () => (
    <Button
      class={cn(
        "max-w-full gap-3 text-center [overflow-wrap:anywhere] pointer-coarse:min-h-11",
        props.class,
      )}
      variant="text"
      onClick={
        props.onClick ??
        (() =>
          showCommandLineForConfig(
            props.openCommandline as CommandlineSubgroupKey,
          ))
      }
      fa={props.icon !== undefined ? { icon: props.icon } : undefined}
    >
      {props.children ?? props.text}
    </Button>
  );

  const DivNotice = () => (
    <div
      class={cn(
        "flex max-w-full items-center gap-2 text-center [overflow-wrap:anywhere]",
        props.class,
      )}
    >
      <Show when={props.icon !== undefined}>
        <Fa icon={props.icon as FaSolidIcon} />
      </Show>
      {props.children ?? props.text}
    </div>
  );

  return (
    <Show when={props.when}>
      <Show when={isButton()} fallback={<DivNotice />}>
        <ButtonNotice />
      </Show>
    </Show>
  );
}
