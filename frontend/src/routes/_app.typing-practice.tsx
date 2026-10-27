import { createFileRoute, Link } from "@tanstack/solid-router";

import { Guide, guideHead } from "../features/discover/guide";

const title = "How to practice typing";
const description =
  "Build typing accuracy with a repeatable practice routine in Caret. Learn how to choose word lists, use quotes and custom text, and compare your progress.";

export const Route = createFileRoute("/_app/typing-practice")({
  head: () => guideHead(title, description, "/typing-practice"),
  component: TypingPractice,
});

function TypingPractice() {
  return (
    <Guide
      title={title}
      intro="Use Caret for free online typing practice with immediate speed and accuracy feedback. Start with a pace you can control, then make the material more varied as you become comfortable."
    >
      <section>
        <h2>Start with a repeatable baseline</h2>
        <p>
          Take a 60-second test in a language you know. Keep the language,
          duration, punctuation and difficulty the same for the next few tests.
          Record both WPM and accuracy: a faster result with many more mistakes
          may not be useful progress.
        </p>
        <p>
          Caret shows your result when the test finishes. Sign in if you want
          your results saved in your account history. You can practice without
          an account too.
        </p>
      </section>
      <section>
        <h2>A simple practice session</h2>
        <ol class="list-decimal space-y-3 pl-6">
          <li>Warm up with familiar words at a comfortable pace.</li>
          <li>
            Take a timed test and notice the letters or sequences you miss.
          </li>
          <li>
            Use custom mode to practice text containing those sequences slowly.
          </li>
          <li>Try a quote to include sentences, capitals and punctuation.</li>
          <li>
            Repeat the original settings and compare accuracy as well as speed.
          </li>
        </ol>
        <p>
          Keep practice manageable and take breaks when you feel tired. There is
          no required daily duration or guaranteed improvement schedule. Aim for
          consistent, deliberate practice instead of chasing every personal
          best.
        </p>
      </section>
      <section>
        <h2>Choose material that matches your goal</h2>
        <p>
          Word mode gives you a fixed amount of text. Time mode gives you a
          fixed duration. Quote mode is useful for connected text, while custom
          mode lets you supply your own practice passage. Different language
          lists and punctuation settings change the difficulty, so compare like
          with like.
        </p>
        <p>
          If you write software, try{" "}
          <Link
            to="/typing-for-programmers"
            class="underline underline-offset-4"
          >
            code typing practice
          </Link>
          . If you are measuring progress, read how to{" "}
          <Link to="/typing-speed-test" class="underline underline-offset-4">
            interpret WPM and accuracy
          </Link>
          .
        </p>
      </section>
      <section>
        <h2>Make the test comfortable</h2>
        <p>
          Choose a readable font, a theme with clear contrast and a caret you
          can follow. Avoid changing several settings at once when comparing
          scores. Caret provides a practice tool and feedback; it does not
          enforce a particular finger placement or a touch-typing lesson
          curriculum.
        </p>
      </section>
    </Guide>
  );
}
