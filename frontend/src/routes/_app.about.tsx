import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/_app/about")({
  head: () => ({
    meta: [
      { title: "About | Oxytype" },
      {
        name: "description",
        content: "About Oxytype, an independent, customizable typing test.",
      },
    ],
  }),
  component: About,
});

function About() {
  return (
    <article class="grid gap-8">
      <h1 class="text-3xl">about</h1>
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
