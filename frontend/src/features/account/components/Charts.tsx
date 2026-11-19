import { ResultFilters, ResultFiltersKeys } from "@caret/schemas/users";
import { useLiveQuery } from "@tanstack/solid-db";
import { Accessor, createMemo, JSXElement } from "solid-js";

import {
  buildResultsQuery,
  ResultsQueryState,
} from "../../../data/collections/results";
import { type TagItem, useTagsLiveQuery } from "../../../data/collections/tags";
import AsyncContent from "../../../ts/components/common/AsyncContent";
import { Balloon } from "../../../ts/components/common/Balloon";
import { Fa } from "../../../ts/components/common/Fa";
import { getConfig } from "../../../ts/config/store";
import { getFormatting, isAuthenticated } from "../../../ts/states/core";
import { FaSolidIcon } from "../../../ts/types/font-awesome";
import {
  capitalizeFirstLetter,
  replaceUnderscoresWithSpaces,
} from "../../../ts/utils/strings";
import { get as getTypingSpeedUnit } from "../../../ts/utils/typing-speed-units";
import { DailyActivityChart } from "./DailyActivityChart";
import { HistogramChart } from "./HistogramChart";
import { HistoryChart, HistoryChartClickEvent } from "./HistoryChart";

export function Charts(props: {
  filters: ResultFilters;
  queryState: Accessor<ResultsQueryState | undefined>;
  onHistoryChartClick?: (event: HistoryChartClickEvent) => void;
}): JSXElement {
  const beginAtZero = createMemo(() => getConfig.startGraphsAtZero);
  const typingSpeedUnit = createMemo(() =>
    getTypingSpeedUnit(getConfig.typingSpeedUnit),
  );
  const format = getFormatting;
  const tags = useTagsLiveQuery();

  const resultsQuery = useLiveQuery((q) => {
    if (!isAuthenticated()) return undefined;
    const state = props.queryState();
    if (state === undefined) return undefined;
    return q
      .from({ r: buildResultsQuery(state) })
      .orderBy(({ r }) => r.timestamp, "desc");
  });

  return (
    <AsyncContent collections={{ resultsQuery }}>
      {({ resultsQueryData }) => (
        <div class="flex flex-col gap-8">
          <div>
            <FilterSummary filters={props.filters} tags={tags()} />
            <HistoryChart
              results={resultsQueryData()}
              beginAtZero={beginAtZero()}
              typingSpeedUnit={typingSpeedUnit()}
              format={format()}
              onClick={(index) => props.onHistoryChartClick?.(index)}
            />
          </div>

          <HistogramChart
            results={resultsQueryData()}
            typingSpeedUnit={typingSpeedUnit()}
          />

          <DailyActivityChart
            queryState={props.queryState}
            beginAtZero={beginAtZero()}
            typingSpeedUnit={typingSpeedUnit()}
            format={format()}
          />
        </div>
      )}
    </AsyncContent>
  );
}

function FilterSummary(props: {
  filters: ResultFilters;
  tags: TagItem[];
}): JSXElement {
  const Item = <
    T extends ResultFiltersKeys,
    K extends keyof ResultFilters[T],
  >(options: {
    group: T;
    icon: FaSolidIcon;
    format?: (val: K) => string;
  }): JSXElement => {
    const values = createMemo(() =>
      isAllSet(props.filters[options.group])
        ? "all"
        : Object.entries(props.filters[options.group])
            .filter(([_, v]) => v)
            .map(([it]) => options.format?.(it as K) ?? it)
            .join(", "),
    );

    return (
      <Balloon
        as="span"
        text={capitalizeFirstLetter(options.group)}
        data-balloon-pos="up"
      >
        <Fa icon={options.icon} fixedWidth />
        {values()}
      </Balloon>
    );
  };

  return (
    <div class="mt-4 mb-4 flex flex-wrap justify-center gap-4 text-sub [&>span>i]:mr-1">
      <Item
        group="date"
        icon="fa-calendar"
        format={replaceUnderscoresWithSpaces}
      />
      <Item group="mode" icon="fa-bars" />
      <Item group="time" icon="fa-clock" />
      <Item group="words" icon="fa-font" />
      <Item group="difficulty" icon="fa-star" />
      <Item group="punctuation" icon="fa-at" />
      <Item group="numbers" icon="fa-hashtag" />
      <Item group="language" icon="fa-globe-americas" />
      <Item
        group="funbox"
        icon="fa-gamepad"
        format={replaceUnderscoresWithSpaces}
      />
      <Item
        group="tags"
        icon="fa-tags"
        format={(tag) => props.tags.find((it) => it._id === tag)?.name ?? tag}
      />
    </div>
  );
}

function isAllSet(
  filter: Record<string | number | symbol, boolean | undefined>,
): boolean {
  return Object.values(filter).every((value) => value);
}
