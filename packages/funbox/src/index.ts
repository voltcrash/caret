import { FunboxName } from "@oxytype/schemas/configs";
import { getList, getFunbox, getObject, getFunboxNames } from "./list";
import { FunboxMetadata, FunboxProperty } from "./types";

export type { FunboxMetadata, FunboxProperty };
export { getFunbox, getFunboxNames };

export function getAllFunboxes(): FunboxMetadata[] {
  return getList();
}

export function getFunboxObject(): Record<FunboxName, FunboxMetadata> {
  return getObject();
}
