import { Language, LanguageObject } from "@oxytype/schemas/languages";
import { FetchJson, Section } from "./languages";
import { cleanTypographySymbols } from "./strings";
import { z } from "zod";

const sectionSchema = z.object({
  query: z.object({
    pages: z.record(z.string(), z.object({ extract: z.string() })),
  }),
});

export type WikipediaDeps = {
  fetchJson: FetchJson;
  getLanguage: (language: Language) => Promise<LanguageObject>;
  htmlToText: (html: string) => string;
};

export async function getSection(
  language: Language,
  deps: WikipediaDeps,
): Promise<Section> {
  const properties = await deps.getLanguage(language);
  const tld = properties.bcp47?.split("-")[0] ?? "en";
  // Retry empty extracts, as the web generator does.
  for (;;) {
    const post = (await deps.fetchJson(
      `https://${tld}.wikipedia.org/api/rest_v1/page/random/summary`,
    )) as { title: string; author: string; pageid: number };
    const data = sectionSchema.parse(
      await deps.fetchJson(
        `https://${tld}.wikipedia.org/w/api.php?action=query&format=json&pageids=${post.pageid}&prop=extracts&exintro=true&origin=*`,
      ),
    );
    const page = data.query.pages[post.pageid.toString()];
    if (!page) throw new Error("Page not found");
    let text = deps.htmlToText(page.extract.replace(/<\/p><p>+/g, " "));
    text = text.replace(/\[\d+\]/gi, "").replace(/[\u200B-\u200D\uFEFF]/g, "");
    text = cleanTypographySymbols(text);
    if (tld === "en") text = text.replace(/[^\x20-\x7E]+/g, "");
    text = text.replace(/\s+/g, " ").trim();
    if (text !== "") {
      return new Section(post.title, post.author, text.split(" "));
    }
  }
}
