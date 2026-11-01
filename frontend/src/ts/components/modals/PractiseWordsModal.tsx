import { For, JSXElement, ParentProps, createSignal } from "solid-js";

import { practiceHistory } from "../../../features/typing/practice-history.client";
import * as PractiseWords from "../../../features/typing/runtime/practise-words";
import * as TestLogic from "../../../features/typing/runtime/test-logic";
import { getConfig } from "../../config/store";
import { hideModalAndClearChain } from "../../states/modals";
import { AnimatedModal } from "../common/AnimatedModal";
import { Button } from "../common/Button";
import { Fa, FaProps } from "../common/Fa";

type Missed = "off" | "words" | "biwords";

const missedOptions: Missed[] = ["off", "words", "biwords"];
const slowOptions: { text: string; value: boolean }[] = [
  { text: "off", value: false },
  { text: "on", value: true },
];

function Group(
  props: ParentProps<{ title: string; fa: FaProps; sub: string }>,
): JSXElement {
  return (
    <div class="grid w-full">
      <div class="text-sub lowercase">
        <Fa {...props.fa} /> {props.title}
      </div>
      <div class="mt-1 mb-2">{props.sub}</div>
      <div class="flex w-full gap-2">{props.children}</div>
    </div>
  );
}

export function PractiseWordsModal(): JSXElement {
  const [missed, setMissed] = createSignal<Missed>("words");
  const [slow, setSlow] = createSignal(false);
  const learning = practiceHistory();
  const weakest = () =>
    learning.weakest(`${getConfig.language}:${getConfig.layout}`);
  const secondsToday = () =>
    learning.history().day === new Date().toLocaleDateString("en-CA")
      ? learning.history().seconds
      : 0;

  const apply = (): void => {
    PractiseWords.init(missed(), slow());
    hideModalAndClearChain("PractiseWords");
    void TestLogic.restart({
      practiseMissed: true,
    });
  };

  return (
    <AnimatedModal
      id="PractiseWords"
      title="Practice words"
      modalClass="max-w-[400px]"
    >
      <div class="mb-4 grid gap-2">
        <p>
          Today’s practice: {Math.floor(secondsToday() / 60)} /{" "}
          {learning.history().goalMinutes} minutes.
        </p>
        <label>
          Daily goal (minutes)
          <input
            type="number"
            class="w-full rounded bg-sub-alt p-2 text-text"
            min="1"
            max="30"
            value={learning.history().goalMinutes}
            onChange={(event) => {
              const value = event.currentTarget.valueAsNumber;
              if (Number.isFinite(value)) learning.setGoal(value);
            }}
          />
        </label>
        <p class="text-sub">
          Recommended:{" "}
          {weakest()
            .slice(0, 5)
            .map((word) => word.word)
            .join(", ") || "Complete a test to build your practice history."}
        </p>
        <Button
          text="Practice weak words · 60 seconds"
          disabled={weakest().length === 0}
          onClick={() => {
            if (PractiseWords.initFromHistory()) {
              hideModalAndClearChain("PractiseWords");
              void TestLogic.restart({ practiseMissed: true });
            }
          }}
        />
        <Button text="Clear practice history" onClick={learning.clear} />
      </div>
      <Group
        title="missed"
        fa={{ icon: "fa-times" }}
        sub="Include missed words or biwords (which include the previous word)."
      >
        <For each={missedOptions}>
          {(option) => (
            <Button
              class="grow"
              text={option}
              active={missed() === option}
              onClick={() => setMissed(option)}
            />
          )}
        </For>
      </Group>
      <Group
        title="slow"
        fa={{ icon: "fa-tachometer-alt" }}
        sub="Include words which you typed slower than others."
      >
        <For each={slowOptions}>
          {(option) => (
            <Button
              class="grow"
              text={option.text}
              active={slow() === option.value}
              onClick={() => setSlow(option.value)}
            />
          )}
        </For>
      </Group>
      <Button
        class="mt-4"
        text="start"
        disabled={missed() === "off" && !slow()}
        onClick={apply}
      />
    </AnimatedModal>
  );
}
