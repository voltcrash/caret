import { ResultFilters, ResultFiltersSchema } from "@oxytype/schemas/users";

import defaultResultFilters from "../../../constants/default-result-filters";
import { sanitize } from "@oxytype/util/sanitize";
import { typedKeys } from "@oxytype/util/objects";

export function mergeWithDefaultFilters(
  filters: Partial<ResultFilters>,
): ResultFilters {
  try {
    const merged = {} as ResultFilters;
    const mergeGroup = <K extends Exclude<keyof ResultFilters, "_id" | "name">>(
      key: K,
    ): ResultFilters[K] => {
      const group = { ...defaultResultFilters[key], ...filters[key] };
      merged[key] = group;
      return group;
    };
    for (const groupKey of typedKeys(defaultResultFilters)) {
      if (groupKey === "_id") {
        let id = filters[groupKey] ?? defaultResultFilters[groupKey];
        if (id === "default-result-filters-id" || id === "") {
          id = "default";
        }
        merged[groupKey] = id;
      } else if (groupKey === "name") {
        merged[groupKey] = filters[groupKey] ?? defaultResultFilters[groupKey];
      } else {
        mergeGroup(groupKey);
      }
    }
    return merged;
  } catch (e) {
    return defaultResultFilters;
  }
}

export function verifyResultFiltersStructure(
  filterIn: ResultFilters,
): ResultFilters {
  const filter = mergeWithDefaultFilters(
    sanitize(ResultFiltersSchema.partial().strip(), structuredClone(filterIn)),
  );

  return filter;
}
