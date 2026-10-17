import { queryOptions } from "@tanstack/solid-query";
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

export const getVersionHistoryQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.versionHistory(),
    queryFn: fetchVersionHistory,
    // Releases ship daily, so reopening the modal should pick up new ones.
    staleTime: 1000 * 60 * 5,
  });

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
