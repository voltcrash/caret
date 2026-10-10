import { useQuery } from "@tanstack/solid-query";
import { For, JSXElement } from "solid-js";

import {
  getContributorsQueryOptions,
  getSpeedHistogramQueryOptions,
  getTypingStatsQueryOptions,
} from "../../queries/public";
import { getActivePage } from "../../states/core";
import { showModal } from "../../states/modals";
import { getTheme } from "../../states/theme";
import { getNumberWithMagnitude } from "../../utils/numbers";
import AsyncContent from "../common/AsyncContent";
import { Button } from "../common/Button";
import { ChartJs } from "../common/ChartJs";
import { H2, H3 } from "../common/Headers";
import { Page } from "../common/Page";
import { CommandPaletteHotkey } from "../hotkeys/CommandPaletteHotkey";
import { QuickRestartHotkey } from "../hotkeys/QuickRestartHotkey";

export function AboutPage(): JSXElement {
  const isOpen = () => getActivePage() === "about";

  const contributors = useQuery(() => ({
    ...getContributorsQueryOptions(),
    enabled: isOpen(),
  }));

  const typingStats = useQuery(() => ({
    ...getTypingStatsQueryOptions(),
    enabled: isOpen(),
  }));

  const speedHistogram = useQuery(() => ({
    ...getSpeedHistogramQueryOptions(),
    enabled: isOpen(),
  }));

  const numberOfHistogramRecords = (data?: { y: number }[]) => {
    if (data === undefined) return "";
    const sum = getNumberWithMagnitude(
      data.reduce((sum, it) => (sum += it.y), 0),
    );
    return `${sum.roundedTo2} ${sum.orderOfMagnitude}`;
  };

  return (
    <Page id="about">
      <div class="content-grid grid gap-8">
        <section class="text-center text-sub">
          Oxytype is independently developed from Monkeytype, originally created
          by Miodec and expanded by its contributors.
          <br />
          <a href="#contributors_title">See contributor credits</a>.
        </section>
        <section>
          <AsyncContent
            alwaysShowContent
            queries={{ typingStats }}
            errorMessage="Failed to get global typing stats"
          >
            {({ typingStatsData }) => (
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <For
                  each={
                    [
                      [
                        "total tests started",
                        () => typingStatsData()?.testsStarted,
                      ],
                      [
                        "total typing time",
                        () => typingStatsData()?.timeTyping,
                      ],
                      [
                        "total tests completed",
                        () => typingStatsData()?.testsCompleted,
                      ],
                    ] as const
                  }
                >
                  {([title, stat]) => (
                    <div class="text-center wrap-break-word">
                      <div class="text-sub">{title}</div>
                      <div class="text-4xl sm:text-5xl">
                        {stat()?.text ?? "-"}
                      </div>
                      <div class="text-xl">{stat()?.subText ?? "-"}</div>
                    </div>
                  )}
                </For>
              </div>
            )}
          </AsyncContent>
        </section>
        <section class="w-full">
          <AsyncContent
            alwaysShowContent
            queries={{ speedHistogram }}
            errorMessage="Failed to get global speed stats for histogram"
          >
            {({ speedHistogramData }) => (
              <>
                <div class="h-48 w-full">
                  <ChartJs
                    name="SpeedHistogram"
                    type="bar"
                    data={{
                      labels: speedHistogramData()?.labels ?? [],
                      datasets: [
                        {
                          yAxisID: "count",
                          label: "Users",
                          data: speedHistogramData()?.data ?? [],
                          minBarLength: 2,
                          backgroundColor: getTheme().main,
                          borderColor: getTheme().main,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      hover: {
                        mode: "nearest",
                        intersect: false,
                      },
                      scales: {
                        x: {
                          axis: "x",
                          bounds: "ticks",
                          display: true,
                          title: {
                            display: false,
                            text: "Bucket",
                          },
                          offset: true,
                        },
                        count: {
                          axis: "y",
                          beginAtZero: true,
                          min: 0,
                          ticks: {
                            autoSkip: true,
                            autoSkipPadding: 20,
                            stepSize: 10,
                          },
                          display: true,
                          title: {
                            display: true,
                            text: "Users",
                          },
                        },
                      },
                      plugins: {
                        annotation: {
                          annotations: [],
                        },
                        tooltip: {
                          animation: { duration: 250 },
                          intersect: false,
                          mode: "index",
                          callbacks: {
                            afterLabel: (context) => {
                              return (
                                (context.raw as { topPercentage?: string })
                                  .topPercentage ?? ""
                              );
                            },
                          },
                        },
                      },
                    }}
                  />
                </div>
                <div class="text-right text-xs text-sub">
                  distribution of time 60 leaderboard results (wpm) <br />
                  {numberOfHistogramRecords(speedHistogramData()?.data)} total
                  results
                </div>
              </>
            )}
          </AsyncContent>
        </section>
        <section>
          <H2 fa={{ icon: "fa-info-circle" }} text="about" />
          <p>
            Oxytype is an independent typing test project based on Monkeytype.
            It offers multiple test modes, progress tracking, themes, and a
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
            By default, this website uses the most common 200 words in the
            English language to generate its tests. You can change to an
            expanded set (1000 most common words) in the options, or change the
            language entirely.
          </p>
        </section>
        <section>
          <H3 fa={{ icon: "fa-keyboard" }} text="keybinds" />
          <p>
            You can use <QuickRestartHotkey /> to restart the typing test. Open
            the command palette by pressing <CommandPaletteHotkey /> - there you
            can access all the functionality you need without touching your
            mouse.
          </p>
        </section>
        <section>
          <H3 fa={{ icon: "fa-list-ol" }} text="stats" />
          <dl class="grid">
            <dt class="col-1 mr-4">wpm</dt>
            <dd class="col-2">
              - total number of characters in the correctly typed words
              (including spaces), divided by 5 and normalised to 60 seconds.
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
              Calculated using the coefficient of variation of raw wpm and
              mapped onto a scale from 0 to 100.
            </dd>
          </dl>
        </section>
        <section>
          <H3 fa={{ icon: "fa-chart-area" }} text="results screen" />
          <p>
            After completing a test you will be able to see your wpm, raw wpm,
            accuracy, character stats, test length, leaderboards info and test
            info (you can hover over some values to get floating point numbers).
            You can also see a graph of your wpm and raw over the duration of
            the test. Remember that the wpm line is a global average, while the
            raw wpm line is a local, momentary value (meaning if you stop, the
            value is 0).
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
              fa={{
                icon: "fa-hands-helping",
              }}
              onClick={() => showModal("Support")}
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
              onClick={() => showModal("Contact")}
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
          <AsyncContent
            queries={{ contributors }}
            errorMessage="Failed to get contributors"
          >
            {({ contributorsData }) => (
              <div
                class="grid"
                style={{
                  "grid-template-columns":
                    "repeat(auto-fill, minmax(13em, 1fr))",
                }}
              >
                <For each={contributorsData()}>
                  {(name) => <div class="wrap-break-word">{name}</div>}
                </For>
              </div>
            )}
          </AsyncContent>
        </section>
      </div>
    </Page>
  );
}
