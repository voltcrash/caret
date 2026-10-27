import { Link } from "@tanstack/solid-router";

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
          Caret is a free, open-source typing test for measuring your typing
          speed in words per minute (WPM) and improving accuracy. Practice in
          your browser with timed tests, word counts, quotes or your own text.
          No account is needed to take a test.
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
        <h3>Is Caret free? Do I need an account?</h3>
        <p>
          Caret is free to use. You can take typing tests without signing in. An
          account lets you save results and view your typing history.
        </p>
        <h3>Can I practice with my own text?</h3>
        <p>
          Yes. Choose custom mode to practice text you provide. Use quote mode
          for sentences or select a language word list for word practice.
        </p>
        <h3>Is Caret open source?</h3>
        <p>
          Yes. Caret is an independent project that began from the Monkeytype
          codebase. Its source is available under the GPL-3.0 license on{" "}
          <a
            href="https://github.com/voltcrash/caret"
            class="underline underline-offset-4"
          >
            GitHub
          </a>
          .
        </p>
      </section>
    </article>
  );
}
