import type { JSXElement } from "solid-js";

import { Button } from "../../ts/components/common/Button";
import { H2 } from "../../ts/components/common/Headers";

/** In-app 404; the root returns it with HTTP 404 for unknown URLs. */
export function NotFoundPage(): JSXElement {
  return (
    <div class="page page404" id="page404">
      <div class="flex h-full items-center justify-center">
        <div class="flex flex-col gap-8 md:flex-row md:gap-16">
          <div class="place-self-center">
            <img
              src="/images/oxytype-404.svg"
              alt="Oxytype typing keys"
              class="max-w-full rounded-xl"
            />
          </div>
          <div class="flex max-w-md flex-col items-center gap-4">
            <H2 text="404" class="pb-0 text-7xl text-main" />
            <p class="text-center">
              Ooops! Looks like this page
              <br />
              or resource doesn&apos;t exist.
            </p>
            <Button
              fa={{ icon: "fa-home" }}
              text="Go Home"
              router-link
              href="/"
              class="px-8 py-4"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
