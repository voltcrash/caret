import { queryOptions } from "@tanstack/solid-query";
import {
  bucketSpeedHistogram,
  formatTypingStats,
  type TypingStatsDisplay,
} from "../../features/about/stats";
import { operation } from "../../data/operations";
import { getContributorsList, getReleaseHistory } from "../utils/json-data";
import {
  releaseNotesToHtml,
  VersionHistoryRelease,
} from "../utils/release-notes";
import { baseKey } from "./utils/keys";
import { format as dateFormat } from "date-fns/format";

const queryKeys = {
  root: () => baseKey("public"),
  contributors: () => [...queryKeys.root(), "contributors"],
  typingStats: () => [...queryKeys.root(), "typingStats"],
  speedHistogram: () => [...queryKeys.root(), "speedHistogram"],
  versionHistory: () => [...queryKeys.root(), "versionHistory"],
};

//cache results for one hour
const staleTime = 1000 * 60 * 60;

export const getContributorsQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.contributors(),
    queryFn: getContributorsList,
    staleTime,
  });

export const getTypingStatsQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.typingStats(),
    queryFn: fetchTypingStats,
    staleTime,
  });

export const getSpeedHistogramQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.speedHistogram(),
    queryFn: fetchSpeedHistogram,
    staleTime,
  });

export const getVersionHistoryQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.versionHistory(),
    queryFn: fetchVersionHistory,
    // Releases ship daily, so reopening the modal should pick up new ones.
    staleTime: 1000 * 60 * 5,
  });

async function fetchSpeedHistogram(): Promise<
  ReturnType<typeof bucketSpeedHistogram>
> {
  const response = await operation("public.getSpeedHistogram", {
    query: {
      language: "english",
      mode: "time",
      mode2: "60",
    },
  });

  if (!response.ok) {
    throw new Error(response.message);
  }
  return bucketSpeedHistogram(response.data);
}

async function fetchTypingStats(): Promise<TypingStatsDisplay> {
  const response = await operation("public.getTypingStats");

  if (!response.ok) {
    throw new Error(response.message);
  }
  return formatTypingStats(response.data);
}

async function fetchVersionHistory(): Promise<VersionHistoryRelease[]> {
  const releases = await getReleaseHistory();
  return releases.slice(0, 10).map((release) => {
    const publishedAt = new Date(release.published_at);
    return {
      tag: release.tag_name,
      name: release.name,
      publishedAt: dateFormat(publishedAt, "dd MMM yyyy"),
      bodyHTML: releaseNotesToHtml(release.body),
    };
  });
}
