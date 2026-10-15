import { getMutableConfig } from "../../config/store";
import { FunboxProperty, getFunboxObject } from "@oxytype/funbox";
import { FunboxName } from "@oxytype/schemas/configs";

const metadata = getFunboxObject();

export function getActiveFunboxNames(): FunboxName[] {
  return getMutableConfig().funbox ?? [];
}

export function isFunboxActive(funbox: FunboxName): boolean {
  return getActiveFunboxNames().includes(funbox);
}

export function isFunboxActiveWithProperty(property: FunboxProperty): boolean {
  return getActiveFunboxNames().some((name) =>
    metadata[name]?.properties?.includes(property),
  );
}
