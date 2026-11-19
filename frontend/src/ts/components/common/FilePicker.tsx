import { createSignal, For, JSXElement, onCleanup, onMount } from "solid-js";

import { createBinding } from "../../../app/binding";
import { useRef } from "../../hooks/useRef";

type PickRequest = {
  accept: string;
  onFile: (file: File | undefined, cleanup: () => void) => Promise<void>;
};
const open = createBinding<(request: PickRequest) => void>();
export function openFilePicker(request: PickRequest): void {
  open.require("File picker is not mounted")(request);
}
function Picker(props: PickRequest & { cleanup: () => void }): JSXElement {
  const [ref, input] = useRef<HTMLInputElement>();
  onMount(() => input()?.click());
  return (
    <input
      aria-label="Choose file"
      ref={ref}
      type="file"
      accept={props.accept}
      class="hidden"
      onChange={(event) =>
        void props.onFile(event.currentTarget.files?.[0], props.cleanup)
      }
    />
  );
}
export function FilePicker(): JSXElement {
  const [requests, setRequests] = createSignal<PickRequest[]>([]);
  const handler = (request: PickRequest): void => {
    setRequests((previous) => [...previous, request]);
  };
  onMount(() => onCleanup(open.bind(handler)));
  return (
    <For each={requests()}>
      {(request) => (
        <Picker
          {...request}
          cleanup={() =>
            setRequests((previous) =>
              previous.filter((value) => value !== request),
            )
          }
        />
      )}
    </For>
  );
}
