import { createFileRoute } from "@tanstack/solid-router";

import { Guide, guideHead } from "../features/discover/guide";

const title = "WPM calculator: characters, time and typing speed";
const updated = "2026-10-30";
const description =
  "Calculate words per minute from characters and elapsed seconds. Work through WPM examples and understand why Caret's scored WPM can differ from a simple calculation.";

export const Route = createFileRoute("/_app/guide/wpm-calculator")({
  head: () => guideHead(title, description, "/guide/wpm-calculator", updated),
  component: WpmCalculator,
});

function WpmCalculator() {
  return (
    <Guide
      title={title}
      updated={updated}
      intro="Calculate basic WPM as (counted characters ÷ 5) ÷ elapsed minutes. With seconds, use WPM = counted characters × 12 ÷ elapsed seconds. For example, 250 counted characters in 30 seconds equal 100 WPM. Use elapsed time greater than zero."
    >
      <section>
        <h2>Calculate WPM step by step</h2>
        <ol class="list-decimal space-y-3 pl-6">
          <li>Record the counted characters and elapsed seconds.</li>
          <li>Divide the characters by five to get standardized words.</li>
          <li>Divide the seconds by 60 to get elapsed minutes.</li>
          <li>Divide standardized words by elapsed minutes to get WPM.</li>
        </ol>
        <p>
          If you count 300 characters over 90 seconds, that is 60 standardized
          words in 1.5 minutes: 40 WPM. The five-character convention lets tests
          compare text with different word lengths. It does not mean every
          dictionary word contains five characters.
        </p>
      </section>
      <section>
        <h2>Convert characters per minute to WPM</h2>
        <p>
          Divide characters per minute (CPM) by five. A rate of 300 CPM is 60
          WPM; 450 CPM is 90 WPM. To convert WPM back to CPM, multiply by five.
          Keep the same character-counting rules on both sides of a comparison.
        </p>
      </section>
      <section>
        <h2>Why the result may differ from Caret WPM</h2>
        <p>
          This calculation is a basic rate, not a recreation of Caret&apos;s
          result scoring. Caret distinguishes correctly typed text from raw
          input. Incorrect input, corrections, unfinished words and test
          settings can affect the score. Counting every key press, including
          backspace, as a character does not reproduce scored WPM.
        </p>
        <p>
          Use the WPM and accuracy shown by the Caret typing test when tracking
          your practice. Use the formula to understand units or check a sample
          whose counted characters and elapsed time you already know. Compare
          runs with the same duration, language, punctuation and mode.
        </p>
      </section>
    </Guide>
  );
}
