import { Link } from "@tanstack/solid-router";
import { For } from "solid-js";

import { aboutFaq } from "./about-faq";

/** Product details and guide links, rendered on the server for /about. */
export function AboutCaret() {
  return (
    <article
      aria-labelledby="about-caret"
      class="mx-auto grid w-full max-w-4xl gap-8 py-8 leading-relaxed text-text"
    >
      <header class="grid gap-4">
        <h1 id="about-caret" class="text-2xl text-main sm:text-3xl">
          About Caret
        </h1>
        <p>
          The Caret typing test is free and open source. Measure your typing
          speed in words per minute (WPM) and practice to improve accuracy. Type
          in your browser with timed tests, word counts, quotes or your own
          text. No account is needed to take a test.
        </p>
        <Link to="/" class="w-fit rounded bg-sub-alt px-5 py-3 text-main">
          Start a free typing test
        </Link>
      </header>
      <div class="grid gap-8 sm:grid-cols-2">
        <section class="grid content-start gap-3">
          <h2 class="text-xl text-main">Practice your way</h2>
          <p>
            Choose different languages, code word lists, punctuation and
            numbers. Adjust themes, fonts, caret style and keyboard settings to
            make practice comfortable. Sign in to save results and follow your
            progress over time.
          </p>
        </section>
        <section class="grid content-start gap-3">
          <h2 class="text-xl text-main">Build speed through accuracy</h2>
          <p>
            Use a comfortable pace first, then compare WPM and accuracy across
            tests with the same settings. Quotes and custom text add practice
            with sentences, capitalization and the material you actually type.
          </p>
        </section>
      </div>
      <nav aria-label="Typing practice guides" class="grid gap-3">
        <h2 class="text-xl text-main">Typing practice guides</h2>
        <Link to="/guide" class="w-fit underline underline-offset-4">
          Browse typing guides
        </Link>
      </nav>
      <section class="grid gap-4">
        <h2 class="text-xl text-main">Questions about Caret</h2>
        <For each={aboutFaq}>
          {(faq) => (
            <div class="grid gap-4">
              <h3>{faq.question}</h3>
              <p>{faq.answer}</p>
            </div>
          )}
        </For>
        <a
          href="https://github.com/voltcrash/caret"
          class="w-fit underline underline-offset-4"
        >
          View Caret on GitHub
        </a>
      </section>
    </article>
  );
}
