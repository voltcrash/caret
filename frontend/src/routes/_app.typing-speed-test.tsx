import { createFileRoute } from "@tanstack/solid-router";

import { Guide, guideHead } from "../features/discover/guide";

const title = "Typing speed test: WPM and accuracy";
const description =
  "Measure typing speed with Caret's free online test. Understand words per minute (WPM), raw speed and accuracy, and compare results with consistent settings.";

export const Route = createFileRoute("/_app/typing-speed-test")({
  head: () => guideHead(title, description, "/typing-speed-test"),
  component: TypingSpeedTest,
});

function TypingSpeedTest() {
  return (
    <Guide
      title={title}
      intro="Caret measures typing speed in words per minute and reports accuracy alongside it. Use a timed test for a quick check, or a word-count test to finish a fixed amount of material."
    >
      <section>
        <h2>How to take a typing speed test</h2>
        <ol class="list-decimal space-y-3 pl-6">
          <li>Open the Caret typing test and choose time mode.</li>
          <li>Select a duration, such as 15, 30, 60 or 120 seconds.</li>
          <li>
            Choose a language and decide whether to include punctuation or
            numbers.
          </li>
          <li>
            Type the displayed text. The test begins when you start typing.
          </li>
          <li>
            Read the result, including WPM and accuracy, when the test ends.
          </li>
        </ol>
        <p>
          You do not need an account to test your speed. Sign in to save your
          results and review your history. Start with 60 seconds if you want a
          longer sample than a short sprint.
        </p>
      </section>
      <section>
        <h2>What does WPM mean?</h2>
        <p>
          WPM means words per minute. Typing tests conventionally treat five
          characters as one word, rather than counting dictionary words. At the
          basic rate, 300 counted characters in one minute equal 60 WPM:
          characters divided by five, divided by elapsed minutes.
        </p>
        <p>
          Caret WPM reflects correctly typed text. Raw speed includes incorrect
          input too, so it can be higher. Corrections, unfinished words and test
          settings affect the final result; raw speed alone does not describe
          how accurately you typed.
        </p>
      </section>
      <section>
        <h2>Why accuracy matters</h2>
        <p>
          Accuracy describes the proportion of correct keystrokes. Correcting a
          mistake does not erase the fact that it happened. Read accuracy with
          WPM to distinguish controlled typing from a fast run with frequent
          errors. If accuracy drops while speed rises, slow down and work on the
          sequences causing mistakes.
        </p>
      </section>
      <section>
        <h2>Compare equivalent tests</h2>
        <p>
          A short test using common words is a different task from a longer
          quote with punctuation. Keep duration, language, mode, difficulty,
          punctuation and numbers consistent when comparing scores. Repeat a few
          tests and look for a pattern instead of judging progress by one
          unusually good or bad run.
        </p>
        <p>
          There is no single WPM target that fits every person or task. Use your
          own baseline and the text you need to type as your reference. Caret
          measures practice performance; it does not issue a typing certificate.
        </p>
      </section>
    </Guide>
  );
}
