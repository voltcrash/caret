import { publicEnv } from "./public-env";

export const homeTitle = "Caret | Free Typing Test & Online Typing Practice";
export const homeDescription =
  "Test your typing speed and accuracy with Caret, a free, open-source typing test. Practice words, quotes and code with customizable themes and languages.";

/** One canonical identity and matching search/social previews per document. */
export function pageHead(
  title: string,
  description: string,
  path: string,
  index = true,
) {
  const url = `${publicEnv.origin}${path}`;
  return {
    links: [{ rel: "canonical", href: url }],
    meta: [
      { title },
      { name: "description", content: description },
      ...(index ? [] : [{ name: "robots", content: "noindex,follow" }]),
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ],
  };
}
