import { publicEnv } from "./public-env";

export { homeDescription, homeTitle } from "./site-identity";

type PageHead = {
  links: { rel: string; href: string }[];
  meta: (
    | { title: string }
    | { name: string; content: string }
    | { property: string; content: string }
  )[];
};

/** One canonical identity and matching search/social previews per document. */
export function pageHead(
  title: string,
  description: string,
  path: string,
  index = true,
): PageHead {
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
