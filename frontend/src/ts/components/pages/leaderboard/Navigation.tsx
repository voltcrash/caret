import { JSXElement, Setter, Show } from "solid-js";
import { z } from "zod";

import { showSimpleModal } from "../../../states/simple-modal";
import { cn } from "../../../utils/cn";
import { Button } from "../../common/Button";
import { LoadingCircle } from "../../common/LoadingCircle";

export function Navigation(props: {
  lastPage: number;
  userPage?: number;
  currentPage: number;
  onPageChange: Setter<number>;
  onScrollToUser: Setter<boolean>;
  isLoading?: boolean;
  class?: string;
}): JSXElement {
  const buttonClass =
    "px-2 xs:px-3 sm:px-4 text-em-base pointer-coarse:min-h-11 pointer-coarse:min-w-11";

  return (
    <div
      class={cn(
        "grid grid-flow-col items-center gap-1 sm:gap-2 justify-self-end",
        props.class,
      )}
    >
      <Show when={props.isLoading}>
        <LoadingCircle color="sub" class="text-2xl" />
      </Show>
      <Button
        aria-label="First leaderboard page"
        onClick={() => props.onPageChange(0)}
        fa={{ icon: "fa-crown", fixedWidth: true }}
        disabled={props.currentPage === 0}
        class={buttonClass}
      />
      <Show when={props.userPage !== undefined}>
        <Button
          aria-label="Show my leaderboard rank"
          onClick={() => {
            props.onPageChange(props.userPage as number);
            props.onScrollToUser(true);
          }}
          fa={{ icon: "fa-user", fixedWidth: true }}
          disabled={
            props.userPage === undefined || props.currentPage === props.userPage
          }
          class={buttonClass}
        />
      </Show>
      <Button
        aria-label="Previous leaderboard page"
        onClick={() => {
          const lastPage = props.lastPage;
          props.onPageChange((old) => Math.max(0, Math.min(old, lastPage) - 1));
        }}
        fa={{ icon: "fa-chevron-left", fixedWidth: true }}
        disabled={props.currentPage === 0}
        class={buttonClass}
      />
      <Button
        onClick={() =>
          showSimpleModal({
            title: "Go to page",
            schema: z.object({
              //not using PageNumberSchema because we don't allow zero here
              pageNumber: z.number().int().min(1),
            }),
            inputs: {
              pageNumber: {
                type: "number",
                placeholder: "Page number",
              },
            },
            buttonText: "Go",
            execFn: async ({ pageNumber }) => {
              props.onPageChange(pageNumber - 1);
              return {
                status: "success",
                showNotification: false,
              };
            },
          })
        }
        fa={{ icon: "fa-hashtag", fixedWidth: true }}
        class={buttonClass}
        disabled={props.lastPage <= 1}
      >
        {" "}
        {props.currentPage + 1}
      </Button>
      <Button
        aria-label="Next leaderboard page"
        onClick={() => props.onPageChange((old) => old + 1)}
        fa={{ icon: "fa-chevron-right", fixedWidth: true }}
        disabled={props.currentPage + 1 >= props.lastPage}
        class={buttonClass}
      />
    </div>
  );
}
