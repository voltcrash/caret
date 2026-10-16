import {
  FunboxMetadata,
  getFunboxObject,
  FunboxProperty,
} from "@oxytype/funbox";

import { FunboxFunctions, getFunboxFunctions } from "./funbox-functions";
import { FunboxName } from "@oxytype/schemas/configs";
import {
  getActiveFunboxNames,
  isFunboxActive,
  isFunboxActiveWithProperty,
} from "./active";

export { getActiveFunboxNames, isFunboxActive, isFunboxActiveWithProperty };

type FunboxMetadataWithFunctions = FunboxMetadata & {
  functions?: FunboxFunctions;
};

const metadata = getFunboxObject();
const functions = getFunboxFunctions();

const metadataWithFunctions = {} as Record<
  FunboxName,
  FunboxMetadataWithFunctions
>;

for (const [name, data] of Object.entries(metadata)) {
  metadataWithFunctions[name as FunboxName] = {
    ...data,
    functions: functions[name as FunboxName],
  };
}

function get(funboxName: FunboxName): FunboxMetadataWithFunctions;
function get(funboxNames: FunboxName[]): FunboxMetadataWithFunctions[];
function get(
  funboxNameOrNames: FunboxName | FunboxName[],
): FunboxMetadataWithFunctions | FunboxMetadataWithFunctions[] {
  if (Array.isArray(funboxNameOrNames)) {
    const fns = funboxNameOrNames.map((name) => metadataWithFunctions[name]);
    return fns;
  } else {
    return metadataWithFunctions[funboxNameOrNames];
  }
}

export function getAllFunboxes(): FunboxMetadataWithFunctions[] {
  return Object.values(metadataWithFunctions);
}

export function getActiveFunboxes(): FunboxMetadataWithFunctions[] {
  return get(getActiveFunboxNames());
}

/**
 * Get all active funboxes defining the given property
 * @param property
 * @returns list of matching funboxes, empty list if none matching
 */
export function getActiveFunboxesWithProperty(
  property: FunboxProperty,
): FunboxMetadataWithFunctions[] {
  return getActiveFunboxes().filter((fb) => fb.properties?.includes(property));
}

type MandatoryFunboxFunction<F extends keyof FunboxFunctions> = Exclude<
  FunboxFunctions[F],
  undefined
>;
type FunboxWithFunction<F extends keyof FunboxFunctions> =
  FunboxMetadataWithFunctions & {
    functions: Record<F, MandatoryFunboxFunction<F>>;
  };

/**
 * Get all active funboxes implementing the given function
 * @param functionName function name
 * @returns list of matching funboxes, empty list if none matching
 */
export function getActiveFunboxesWithFunction<F extends keyof FunboxFunctions>(
  functionName: F,
): FunboxWithFunction<F>[] {
  return getActiveFunboxes().filter(
    (fb) => fb.functions?.[functionName] !== undefined,
  ) as FunboxWithFunction<F>[];
}

/**
 * Find a single active funbox implementing the given function name
 * @param functionName
 * @returns the active funbox if any, `undefined`  otherwise.
 * @throws Error if there are multiple funboxes implementing the function name
 */
export function findSingleActiveFunboxWithFunction<
  F extends keyof FunboxFunctions,
>(functionName: F): FunboxWithFunction<F> | undefined {
  const matching = getActiveFunboxesWithFunction(functionName);
  if (matching.length === 0) return undefined;
  if (matching.length === 1) return matching[0];
  throw new Error(
    `Expecting exactly one funbox implementing "${functionName} but found ${matching.length}`,
  );
}
