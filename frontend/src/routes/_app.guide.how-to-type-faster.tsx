import { createFileRoute } from "@tanstack/solid-router";

import { Guide, guideHead } from "../features/discover/guide";

const title = "How to type faster without losing accuracy";
const updated = "2026-10-30";
const description =
  "Use Caret to find typing mistakes, practice difficult sequences and compare speed fairly. A practical routine for improving WPM without chasing a single high score.";

export const Route = createFileRoute("/_app/guide/how-to-type-faster")({
  head: () =>
    guideHead(title, description, "/guide/how-to-type-faster", updated),
  component: TypeFaster,
});

function TypeFaster() {
  return (
    <Guide
      title={title}
      updated={updated}
      intro="To work on typing faster, first record a comfortable baseline with consistent settings. Review mistakes, practice the sequences that interrupt your rhythm, then retest at a slightly quicker pace. Read WPM alongside accuracy; a faster run with more errors is a different result, not automatically progress."
    >
      <section>
        <h2>Find what slows you down</h2>
        <p>
          Take a 60-second test in the Caret typing test using your usual
          language. Notice whether you pause at unfamiliar words, punctuation,
          capital letters or repeated letter combinations. Keep those settings
          for later comparisons instead of switching to easier text to raise
          WPM.
        </p>
        <p>
          Write down the troublesome sequences. In custom mode, make a short
          practice passage containing them in several different words. Start at
          a pace where you can type them correctly, then use fresh text to see
          whether the practice carries over.
        </p>
      </section>
      <section>
        <h2>Try a short practice session</h2>
        <ol class="list-decimal space-y-3 pl-6">
          <li>Warm up with familiar words at a comfortable pace.</li>
          <li>Take a baseline test and note both WPM and accuracy.</li>
          <li>Practice the specific words or symbols that caused mistakes.</li>
          <li>Retest using the original settings and fresh text.</li>
          <li>Save or record the results so you can compare later sessions.</li>
        </ol>
        <p>
          Treat this as a routine to try, not a promise of a particular WPM gain
          or deadline. Take breaks when tired. A comfortable keyboard position
          and readable text help you focus on the practice itself.
        </p>
      </section>
      <section>
        <h2>Check that the improvement matches your goal</h2>
        <p>
          If you mainly type prose, add quotes with capitalization and
          punctuation. For code transcription, use code word lists or custom
          snippets. A common-word sprint does not measure every task you do at a
          keyboard, and typing speed does not measure programming ability.
        </p>
        <p>
          Compare several tests across sessions. Look for a repeatable rise in
          WPM with similar accuracy rather than one personal best. Signing in
          lets Caret save results; an account is not needed to practice.
        </p>
      </section>
    </Guide>
  );
}
