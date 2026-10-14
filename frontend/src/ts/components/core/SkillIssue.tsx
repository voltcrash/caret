import { createSignal, JSXElement, onCleanup, onMount, Show } from "solid-js";

export function SkillIssue(): JSXElement {
  const [isWaiting, setWaiting] = createSignal(false);
  onMount(() => {
    const timer = setTimeout(() => setWaiting(true), 5000);
    onCleanup(() => clearTimeout(timer));
  });
  return (
    <div class="centerbox pointer-events-none fixed top-1/2 left-1/2 w-full max-w-[800px] -translate-x-1/2 -translate-y-1/2 text-center">
      <h1 class="mb-4 text-[3rem]">Fixing skill issue...</h1>
      <iframe
        class="aspect-[4/3] w-full border-0"
        src="https://www.youtube.com/embed/dQw4w9WgXcQ?si=Kr48u8WHcwvX95G7&controls=0&autoplay=1&mute=0&disablekb=1&fs=0&modestbranding=1"
        title="YouTube video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen
      ></iframe>
      <Show when={isWaiting()}>
        <p class="mt-4 text-[1.5rem]">
          If your skill issue is not fixed yet, please wait a bit longer...
        </p>
      </Show>
    </div>
  );
}
