import { Language } from "@caret/schemas/languages";

declare module "virtual:language-hashes" {
  export const languageHashes: Record<Language, string>;
  export const englishHash: string | undefined;
}
