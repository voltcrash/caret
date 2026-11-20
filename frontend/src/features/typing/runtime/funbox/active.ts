import { peekConfig } from "#shared/config/store.ts";
import { FunboxProperty, getFunboxObject } from "@caret/funbox";
import { FunboxName } from "@caret/schemas/configs";

const metadata = getFunboxObject();

export function getActiveFunboxNames(): FunboxName[] {
  return peekConfig().funbox ?? [];
}

export function isFunboxActiveWithProperty(property: FunboxProperty): boolean {
  return getActiveFunboxNames().some((name) =>
    metadata[name]?.properties?.includes(property),
  );
}
