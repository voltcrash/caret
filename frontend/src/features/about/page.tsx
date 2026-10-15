import { useQuery } from "@tanstack/solid-query";
import { ClientOnly } from "@tanstack/solid-router";
import { createClientOnlyFn } from "@tanstack/solid-start";
import {
  createEffect,
  createMemo,
  For,
  lazy,
  Show,
  Suspense,
  type JSXElement,
} from "solid-js";

import { onlyCachedOnServer } from "../../data/prefetch";
import { speedHistogramOptions, typingStatsOptions } from "../../data/public";
import { Button } from "../../ts/components/common/Button";
import { H2, H3 } from "../../ts/components/common/Headers";
import {
  bucketSpeedHistogram,
  formatTypingStats,
  histogramTotal,
} from "./stats";

const load = createClientOnlyFn(
  async () => (await import("./details.client")).about,
);
const Histogram = lazy(async () => ({ default: (await load()).Histogram }));
const Contributors = lazy(async () => ({
  default: (await load()).Contributors,
}));
const QuickRestartHotkey = lazy(async () => ({
  default: (await load()).QuickRestartHotkey,
}));
const CommandPaletteHotkey = lazy(async () => ({
  default: (await load()).CommandPaletteHotkey,
}));
const openModal = createClientOnlyFn(async (id: "Support" | "Contact") =>
  (await load()).showModal(id),
);
const notifyError = createClientOnlyFn(
  async (message: string, error: unknown) =>
    (await load()).notifyError(message, error),
);

const enabled = onlyCachedOnServer(!import.meta.env.OXYTYPE_OFFLINE);

function Leaf(props: { children: JSXElement; fallback?: JSXElement }) {
  return (
    <ClientOnly fallback={props.fallback}>
      <Suspense fallback={props.fallback}>{props.children}</Suspense>
    </ClientOnly>
  );
}

/**
 * Public about page. Text, global counters and the histogram caption render
 * on the server from the route's prefetched Query data; the chart, live
 * hotkeys, contributor list and modals are browser leaves.
 */
export function AboutPage(): JSXElement {
  const typingStats = useQuery(() => ({ ...typingStatsOptions(), enabled }));
  const speedHistogram = useQuery(() => ({
    ...speedHistogramOptions(),
    enabled,
  }));
  const stats = createMemo(() =>
    typingStats.data === undefined
      ? undefined
      : formatTypingStats(typingStats.data),
  );
  const histogram = createMemo(() =>
    speedHistogram.data === undefined
      ? undefined
      : bucketSpeedHistogram(speedHistogram.data),
  );
  createEffect(() => {
    if (typingStats.isError) {
      void notifyError("Failed to get global typing stats", typingStats.error);
    }
  });
  createEffect(() => {
    if (speedHistogram.isError) {
      void notifyError(
        "Failed to get global speed stats for histogram",
        speedHistogram.error,
      );
    }
  });
  const counters = [
    ["total tests started", "tests-started", "testsStarted"],
    ["total typing time", "time-typing", "timeTyping"],
    ["total tests completed", "tests-completed", "testsCompleted"],
  ] as const;
  return (
    <div class="content-grid grid gap-8">
      <section class="text-center text-sub">
        Oxytype is independently developed from Monkeytype, originally created
        by Miodec and expanded by its contributors.
        <br />
        <a href="#contributors_title">See contributor credits</a>.
      </section>
      <section aria-label="Global typing statistics">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <For each={counters}>
            {([title, id, key]) => (
              <div class="text-center wrap-break-word">
                <div class="text-sub">{title}</div>
                <div class="text-4xl sm:text-5xl" data-testid={id}>
                  {stats()?.[key].text ?? "-"}
                </div>
                <div class="text-xl">{stats()?.[key].subText ?? "-"}</div>
              </div>
            )}
          </For>
        </div>
      </section>
      <section class="w-full">
        <div class="h-48 w-full">
          <Show when={histogram()}>
            {(data) => (
              <Leaf>
                <Histogram labels={data().labels} data={data().data} />
              </Leaf>
            )}
          </Show>
        </div>
        <div class="text-right text-xs text-sub">
          distribution of time 60 leaderboard results (wpm) <br />
          {histogram() === undefined
            ? ""
            : histogramTotal(histogram()?.data ?? [])}{" "}
          total results
        </div>
      </section>
      <section>
        <H2 fa={{ icon: "fa-info-circle" }} text="about" />
        <p>
          Oxytype is an independent typing test project based on Monkeytype. It
          offers multiple test modes, progress tracking, themes, and a
          customizable typing experience. The original Monkeytype project was
          created by Miodec; its contributors remain credited here and in the
          repository.
          <br />
          <br />
          Test yourself in various modes, track your progress and improve your
          speed.
        </p>
      </section>
      <section>
        <H3 fa={{ icon: "fa-align-left" }} text="word set" />
        <p>
          By default, this website uses the most common 200 words in the English
          language to generate its tests. You can change to an expanded set
          (1000 most common words) in the options, or change the language
          entirely.
        </p>
      </section>
      <section>
        <H3 fa={{ icon: "fa-keyboard" }} text="keybinds" />
        <p>
          You can use{" "}
          <Leaf fallback={<kbd>tab</kbd>}>
            <QuickRestartHotkey />
          </Leaf>{" "}
          to restart the typing test. Open the command palette by pressing{" "}
          <Leaf fallback={<kbd>ctrl/cmd + shift + p</kbd>}>
            <CommandPaletteHotkey />
          </Leaf>{" "}
          - there you can access all the functionality you need without touching
          your mouse.
        </p>
      </section>
      <section>
        <H3 fa={{ icon: "fa-list-ol" }} text="stats" />
        <dl class="grid">
          <dt class="col-1 mr-4">wpm</dt>
          <dd class="col-2">
            - total number of characters in the correctly typed words (including
            spaces), divided by 5 and normalised to 60 seconds.
          </dd>

          <dt class="col-1 mr-4">raw wpm</dt>
          <dd class="col-2">
            {" "}
            - calculated just like wpm, but also includes incorrect words.
          </dd>

          <dt class="col-1 mr-4">acc</dt>
          <dd class="col-2"> - percentage of correctly pressed keys.</dd>

          <dt class="col-1 mr-4">char</dt>
          <dd class="col-2">
            - correct characters / incorrect characters. Calculated after the
            test has ended.
          </dd>

          <dt class="col-1 mr-4">consistency</dt>
          <dd class="col-2">
            - based on the variance of your raw wpm. Closer to 100% is better.
            Calculated using the coefficient of variation of raw wpm and mapped
            onto a scale from 0 to 100.
          </dd>
        </dl>
      </section>
      <section>
        <H3 fa={{ icon: "fa-chart-area" }} text="results screen" />
        <p>
          After completing a test you will be able to see your wpm, raw wpm,
          accuracy, character stats, test length, leaderboards info and test
          info (you can hover over some values to get floating point numbers).
          You can also see a graph of your wpm and raw over the duration of the
          test. Remember that the wpm line is a global average, while the raw
          wpm line is a local, momentary value (meaning if you stop, the value
          is 0).
        </p>
      </section>
      <section>
        <H3 fa={{ icon: "fa-bug" }} text="bug report or feature request" />
        <p>Report a bug or suggest a feature in the Oxytype repository.</p>
      </section>
      <div></div>
      <section>
        <H2 fa={{ icon: "fa-life-ring" }} text="support" />
        <p>
          Help Oxytype grow by contributing code, reporting bugs, and helping
          other users.
        </p>
        <div class="mt-4 text-xl">
          <Button
            fa={{ icon: "fa-hands-helping" }}
            onClick={() => void openModal("Support")}
            text="support"
            class="w-full p-8"
          />
        </div>
      </section>
      <div></div>
      <section>
        <H2 fa={{ icon: "fa-envelope" }} text="contact" />
        <p>Report bugs or request features through the Oxytype repository.</p>
        <div class="mt-4 grid w-full grid-cols-1 gap-4 text-xl sm:grid-cols-2 lg:grid-cols-4">
          <Button
            text="mail"
            fa={{ icon: "fa-envelope" }}
            onClick={() => void openModal("Contact")}
            class="w-full p-8"
          />
          <Button
            text="discussions"
            fa={{ icon: "fa-comments" }}
            href="https://github.com/voltcrash/oxytype/discussions"
            class="w-full p-8"
          />
          <Button
            text="github"
            fa={{ icon: "fa-github", variant: "brand" }}
            href="https://github.com/voltcrash/oxytype"
            class="w-full p-8"
          />
        </div>
      </section>
      <div></div>
      <section>
        <H2 fa={{ icon: "fa-users" }} text="credits" />
        <p>
          <Button
            variant="text"
            text="Montydrei"
            href="https://www.reddit.com/user/montydrei"
            class="p-0 pt-2 pr-2 pb-2"
          />
          for suggesting the original Monkeytype name
        </p>
        <p>
          <Button
            variant="text"
            text="Everyone"
            href="https://www.reddit.com/r/MechanicalKeyboards/comments/gc6wx3/experimenting_with_a_completely_new_type_of/"
            class="p-0 pt-2 pr-2 pb-2"
          />
          who provided valuable feedback on the original reddit post for the
          Monkeytype prototype
        </p>
        <p>Supporters who helped the original project financially.</p>
        <p>
          <Button
            variant="text"
            text="Contributors"
            href="https://github.com/voltcrash/oxytype/graphs/contributors"
            class="p-0 pt-2 pr-2 pb-2"
          />
          who built the original project and continue to improve Oxytype
        </p>
      </section>
      <div></div>
      <section>
        <H2
          id="contributors_title"
          fa={{ icon: "fa-code-branch" }}
          text="contributors"
        />
        <Leaf>
          <Contributors />
        </Leaf>
      </section>
    </div>
  );
}
