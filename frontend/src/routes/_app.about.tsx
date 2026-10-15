import { useQuery } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";

import { publicEnv } from "../app/public-env";
import { typingStatsOptions } from "../data/public";

export const Route = createFileRoute("/_app/about")({
  loader: async ({ context }) => {
    if (!import.meta.env.OXYTYPE_OFFLINE) {
      await context.queryClient.query(typingStatsOptions());
    }
  },
  head: () => ({
    links: [{ rel: "canonical", href: `${publicEnv.origin}/about` }],
    meta: [
      { title: "About | Oxytype" },
      { property: "og:title", content: "About | Oxytype" },
      { property: "og:url", content: `${publicEnv.origin}/about` },
      {
        name: "description",
        content: "About Oxytype, an independent, customizable typing test.",
      },
    ],
  }),
  component: About,
});

function About() {
  const stats = useQuery(() => ({
    ...typingStatsOptions(),
    enabled: !import.meta.env.OXYTYPE_OFFLINE,
  }));
  return (
    <article class="grid gap-8">
      <h1 class="text-3xl">about</h1>
      <dl
        class="grid gap-4 sm:grid-cols-3"
        aria-label="Global typing statistics"
      >
        <div>
          <dt>total tests started</dt>
          <dd data-testid="tests-started">{stats.data?.testsStarted ?? "-"}</dd>
        </div>
        <div>
          <dt>total typing time (seconds)</dt>
          <dd>{stats.data?.timeTyping ?? "-"}</dd>
        </div>
        <div>
          <dt>total tests completed</dt>
          <dd data-testid="tests-completed">
            {stats.data?.testsCompleted ?? "-"}
          </dd>
        </div>
      </dl>
      <p>
        Oxytype is an independent typing test project based on Monkeytype. It
        offers multiple test modes, progress tracking, themes, and a
        customizable typing experience. The original Monkeytype project was
        created by Miodec; its contributors remain credited here and in the
        repository.
      </p>
      <p>
        Test yourself in various modes, track your progress and improve your
        speed.
      </p>
    </article>
  );
}
