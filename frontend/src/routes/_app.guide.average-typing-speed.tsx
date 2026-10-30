import { createFileRoute, Link } from "@tanstack/solid-router";

import { Guide, guideHead } from "../features/discover/guide";

const title = "Average typing speed: compare WPM fairly";
const updated = "2026-10-30";
const description =
  "Understand what an average WPM measures, calculate your own baseline and avoid comparing personal bests with population averages or different typing test settings.";

export const Route = createFileRoute("/_app/guide/average-typing-speed")({
  head: () =>
    guideHead(title, description, "/guide/average-typing-speed", updated),
  component: AverageTypingSpeed,
});

function AverageTypingSpeed() {
  return (
    <Guide
      title={title}
      updated={updated}
      intro="An average typing speed only makes sense with a defined group and test method. Keep language, duration, text and error rules consistent before comparing WPM. For practice, calculate a baseline from several of your own comparable tests instead of treating a leaderboard personal best as a typical typing speed."
    >
      <section>
        <h2>Calculate your own average WPM</h2>
        <p>
          Add the WPM scores from comparable tests and divide by the number of
          tests. For example, scores of 50, 55 and 60 WPM have a mean of 55 WPM:
          (50 + 55 + 60) ÷ 3. These are worked examples, not Caret user
          statistics.
        </p>
        <p>
          The median is the middle score after sorting. For 50, 55 and 90 WPM,
          the median is 55 WPM while the mean is 65 WPM. An unusually fast run
          changes the mean more than the median. Record accuracy too, so you can
          tell whether a higher speed came with more errors.
        </p>
      </section>
      <section>
        <h2>Keep the comparison consistent</h2>
        <ul class="list-disc space-y-3 pl-6">
          <li>Use the same language, test mode and duration.</li>
          <li>Keep punctuation, numbers and difficulty settings unchanged.</li>
          <li>Compare fresh text rather than repeatedly memorized text.</li>
          <li>Compare several sessions instead of only your highest result.</li>
        </ul>
        <p>
          If you combine tests of different lengths, the mean of their WPM
          scores weights every test equally. A combined character rate instead
          divides all counted characters by five and by total elapsed minutes.
          Those answer different questions; label the method you use.
        </p>
      </section>
      <section>
        <h2>Why leaderboards do not establish a population average</h2>
        <p>
          Caret&apos;s all-time speed boards rank personal bests for specific
          test settings. Its speed histogram is built from those ranked records,
          not every completed test or a representative sample of all typists. It
          cannot establish the average typing speed of the general population.
        </p>
        <p>
          Use the{" "}
          <Link to="/leaderboards" class="underline underline-offset-4">
            Caret leaderboards
          </Link>{" "}
          to explore ranked performances. Use your own result history to track
          practice. Caret does not publish a population-wide average WPM here;
          such a claim would need a documented sample, collection period,
          filtering rules and calculation method.
        </p>
      </section>
    </Guide>
  );
}
