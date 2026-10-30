import { createFileRoute, Link } from "@tanstack/solid-router";

import { pageHead } from "../app/seo";

export const Route = createFileRoute("/_app/guide/")({
  head: () =>
    pageHead(
      "Typing Guides | Caret",
      "Explore Caret's typing guides: build accuracy, understand typing speed and WPM, and practice typing for programmers.",
      "/guide",
    ),
  component: Guides,
});

function Guides() {
  return (
    <article class="mx-auto grid w-full max-w-3xl content-start gap-8 py-8 leading-relaxed text-text">
      <header class="grid gap-4">
        <h1 class="text-2xl text-main sm:text-3xl">Typing guides</h1>
        <p>
          Learn how to practice accurately, understand your results and choose
          material that matches what you type.
        </p>
      </header>
      <nav aria-label="Typing guides" class="grid gap-6">
        <Link
          to="/guide/how-to-type-faster"
          class="grid gap-2 rounded bg-sub-alt p-5"
        >
          <h2 class="text-xl text-main">
            How to type faster without losing accuracy
          </h2>
          <p>
            Find troublesome sequences and check that practice carries over.
          </p>
        </Link>
        <Link
          to="/guide/wpm-calculator"
          class="grid gap-2 rounded bg-sub-alt p-5"
        >
          <h2 class="text-xl text-main">WPM calculator and worked examples</h2>
          <p>Convert characters and elapsed time into words per minute.</p>
        </Link>
        <Link
          to="/guide/typing-practice"
          class="grid gap-2 rounded bg-sub-alt p-5"
        >
          <h2 class="text-xl text-main">
            How to practice typing and build accuracy
          </h2>
          <p>Build a repeatable practice routine and compare your progress.</p>
        </Link>
        <Link
          to="/guide/typing-speed-test"
          class="grid gap-2 rounded bg-sub-alt p-5"
        >
          <h2 class="text-xl text-main">
            How to test your typing speed and understand WPM
          </h2>
          <p>Read WPM, raw speed and accuracy with consistent test settings.</p>
        </Link>
        <Link
          to="/guide/typing-for-programmers"
          class="grid gap-2 rounded bg-sub-alt p-5"
        >
          <h2 class="text-xl text-main">Typing practice for programmers</h2>
          <p>
            Practice code word lists, symbols and identifiers with custom text.
          </p>
        </Link>
      </nav>
      <Link to="/" class="w-fit rounded bg-sub-alt px-5 py-3 text-main">
        Start a free typing test
      </Link>
    </article>
  );
}
