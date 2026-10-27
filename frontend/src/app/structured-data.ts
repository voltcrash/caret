import { publicEnv } from "./public-env";
import { homeDescription, homeTitle } from "./seo";

/** Only public, repository-verified facts; no invented reviews or ratings. */
export function homeStructuredData(): Record<string, unknown> {
  const url = `${publicEnv.origin}/`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${url}#website`,
        name: "Caret",
        alternateName: "Caret Typing Test",
        url,
        inLanguage: "en",
      },
      {
        "@type": "WebApplication",
        "@id": `${url}#application`,
        name: "Caret",
        url,
        description: homeDescription,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Any",
        browserRequirements: "Requires JavaScript and a modern web browser.",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        license: "https://www.gnu.org/licenses/gpl-3.0.html",
        sameAs: ["https://github.com/voltcrash/caret"],
        image: `${publicEnv.origin}/images/og/caret.png`,
        featureList: [
          "Typing speed and accuracy feedback",
          "Timed and word-count typing tests",
          "Quotes and custom text practice",
          "Multiple languages and code word lists",
          "Customizable themes and keyboard settings",
          "Account-based result history",
        ],
      },
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: homeTitle,
        description: homeDescription,
        isPartOf: { "@id": `${url}#website` },
        mainEntity: { "@id": `${url}#application` },
      },
    ],
  };
}

/** Escaping '<' keeps JSON inside its script even when text contains HTML. */
export function structuredDataScript(data: object): {
  type: string;
  children: string;
} {
  return {
    type: "application/ld+json",
    children: JSON.stringify(data).replaceAll("<", "\\u003c"),
  };
}
