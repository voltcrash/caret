import type { ParentProps } from "solid-js";

import { Link } from "@tanstack/solid-router";

import { publicEnv } from "../../app/public-env";
import { pageHead } from "../../app/seo";
import { structuredDataScript } from "../../app/structured-data";

export function guideHead(title: string, description: string, path: string) {
  return {
    ...pageHead(`${title} | Caret`, description, path),
    scripts: [
      structuredDataScript({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Caret",
            item: `${publicEnv.origin}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: title,
            item: `${publicEnv.origin}${path}`,
          },
        ],
      }),
    ],
  };
}

export function Guide(props: ParentProps<{ title: string; intro: string }>) {
  return (
    <article class="mx-auto grid w-full max-w-3xl content-start gap-8 py-8 leading-relaxed text-text [&_h2]:text-xl [&_h2]:text-main [&_section]:grid [&_section]:gap-4">
      <nav aria-label="Breadcrumb" class="text-sm">
        <Link to="/" class="underline underline-offset-4">
          Caret
        </Link>
        <span aria-hidden="true"> / </span>
        <span>{props.title}</span>
      </nav>
      <header class="grid gap-4">
        <h1 class="text-2xl text-main sm:text-3xl">{props.title}</h1>
        <p>{props.intro}</p>
        <Link to="/" class="w-fit rounded bg-sub-alt px-5 py-3 text-main">
          Start a free typing test
        </Link>
      </header>
      {props.children}
      <nav
        aria-label="More typing guides"
        class="grid gap-3 border-t border-sub-alt pt-8"
      >
        <h2>Keep practicing</h2>
        <Link to="/typing-practice" class="w-fit underline underline-offset-4">
          Typing practice and accuracy
        </Link>
        <Link
          to="/typing-speed-test"
          class="w-fit underline underline-offset-4"
        >
          Typing speed and WPM
        </Link>
        <Link
          to="/typing-for-programmers"
          class="w-fit underline underline-offset-4"
        >
          Typing for programmers
        </Link>
      </nav>
      <p class="text-sm text-sub">
        Written for Caret by Caret contributors. Caret is free and open source;{" "}
        <a
          href="https://github.com/voltcrash/caret"
          class="underline underline-offset-4"
        >
          view the source or suggest a correction
        </a>
        .
      </p>
    </article>
  );
}
