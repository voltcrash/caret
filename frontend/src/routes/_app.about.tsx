import { createFileRoute } from "@tanstack/solid-router";

import { publicEnv } from "../app/public-env";
import { pageHead } from "../app/seo";
import {
  organizationStructuredData,
  structuredDataScript,
} from "../app/structured-data";
import { AboutCaret } from "../features/discover/about";
import { aboutFaq } from "../features/discover/about-faq";

export const Route = createFileRoute("/_app/about")({
  head: () => ({
    ...pageHead(
      "About Caret | Free Typing Test & Online Typing Practice",
      "Learn about Caret, a free, open-source typing test. Explore typing modes, customization, practice guides and answers to common questions.",
      "/about",
    ),
    scripts: [
      structuredDataScript({
        "@context": "https://schema.org",
        "@graph": [
          organizationStructuredData(),
          {
            "@type": "FAQPage",
            "@id": `${publicEnv.origin}/about#webpage`,
            url: `${publicEnv.origin}/about`,
            name: "About Caret",
            about: { "@id": `${publicEnv.origin}/#organization` },
            mainEntity: aboutFaq.map((faq) => ({
              "@type": "Question",
              name: faq.question,
              acceptedAnswer: { "@type": "Answer", text: faq.answer },
            })),
          },
        ],
      }),
    ],
  }),
  component: AboutCaret,
});
