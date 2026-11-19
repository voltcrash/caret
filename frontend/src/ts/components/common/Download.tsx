import { createSignal, JSXElement, onCleanup, onMount } from "solid-js";

import { createBinding } from "../../../app/binding";
import { useRef } from "../../hooks/useRef";

type DownloadOptions = { filename: string; data: Blob };
const triggerDownload = createBinding<(options: DownloadOptions) => void>();

export function download(options: DownloadOptions): void {
  triggerDownload.require("Download is not mounted")(options);
}

export function Download(): JSXElement {
  const [linkRef, link] = useRef<HTMLAnchorElement>();
  const [target, setTarget] = createSignal({ url: "", filename: "" });
  const trigger = (options: DownloadOptions): void => {
    const url = URL.createObjectURL(options.data);
    setTarget({ url, filename: options.filename });
    link()?.click();
    setTarget({ url: "", filename: "" });
    URL.revokeObjectURL(url);
  };
  onMount(() => onCleanup(triggerDownload.bind(trigger)));
  return (
    <a
      ref={linkRef}
      class="hidden"
      href={target().url}
      download={target().filename}
    ></a>
  );
}
