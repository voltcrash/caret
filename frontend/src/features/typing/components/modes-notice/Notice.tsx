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
    compact?: boolean;
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
        props.compact &&
          "h-14 w-full min-w-0 flex-col gap-0 p-1 sm:h-11 sm:flex-row sm:gap-1.5 sm:p-2 [&>i]:shrink-0",
        props.class,
      )}
      balloon={
        props.compact && props.text !== undefined
          ? { text: props.text }
          : undefined
      }
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
      <Show when={props.compact} fallback={props.children ?? props.text}>
        <span class="line-clamp-2 min-w-0 whitespace-pre-line sm:block sm:truncate sm:whitespace-normal">
          {props.children ?? props.text}
        </span>
      </Show>
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
