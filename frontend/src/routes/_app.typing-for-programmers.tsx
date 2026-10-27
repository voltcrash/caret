import { createFileRoute } from "@tanstack/solid-router";

import { Guide, guideHead } from "../features/discover/guide";

const title = "Typing practice for programmers";
const updated = "2026-10-27";
const description =
  "Practice code typing with Caret's programming language word lists and custom text. Work on symbols, capitalization and accuracy alongside regular typing tests.";

export const Route = createFileRoute("/_app/typing-for-programmers")({
  head: () => guideHead(title, description, "/typing-for-programmers", updated),
  component: TypingForProgrammers,
});

function TypingForProgrammers() {
  return (
    <Guide
      title={title}
      updated={updated}
      intro="For code typing practice in Caret, select a code word list such as code_javascript or code_python, or use custom mode for a sample passage with symbols and identifiers. Track accuracy alongside WPM. These tests measure transcription, not programming ability."
    >
      <section>
        <h2>Practice a programming language word list</h2>
        <p>
          Open the typing test language selector and look for a code list, such
          as code_javascript or code_python. Choose time or word mode, then type
          the displayed material. Code lists are practice vocabulary; they are
          not complete programs or coding exercises.
        </p>
        <p>
          A code list can feel slower than a familiar English list. That is a
          different task, so compare results within the same list and settings.
          Begin at a pace where you can place each character accurately.
        </p>
      </section>
      <section>
        <h2>Use custom text for the characters you miss</h2>
        <p>
          Switch to custom mode and provide a short practice passage containing
          the identifiers, symbols or letter combinations you want to improve.
          For example, mix camelCase and snake_case names with parentheses,
          brackets, braces and operators. Preview the resulting test so you know
          exactly what material you will type.
        </p>
        <p>
          Use sample text that is safe to share. Avoid pasting passwords, tokens
          or confidential source code into a practice tool.
        </p>
      </section>
      <section>
        <h2>A focused code typing routine</h2>
        <ol class="list-decimal space-y-3 pl-6">
          <li>Warm up with ordinary words using your usual keyboard layout.</li>
          <li>Take a short test with your chosen code word list.</li>
          <li>
            Notice recurring mistakes in capitals, symbols or identifiers.
          </li>
          <li>Practice a small custom passage containing those patterns.</li>
          <li>Repeat the same code list and compare accuracy and WPM.</li>
        </ol>
        <p>
          Adjust the font, theme and caret for readability. Keep your keyboard
          layout and test settings consistent when measuring progress. Include
          breaks instead of continuing through fatigue.
        </p>
      </section>
      <section>
        <h2>What code typing practice measures</h2>
        <p>
          These tests measure transcription speed and accuracy. They do not
          evaluate programming knowledge, debugging, editor shortcuts or the
          time spent deciding what code to write. A higher typing score is one
          practice metric, not a measure of software engineering ability.
        </p>
      </section>
    </Guide>
  );
}
