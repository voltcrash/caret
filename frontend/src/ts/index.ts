// Opt-in instrumentation registers before application signals are created.
import "virtual:devtools";

import { render } from "solid-js/web";
import { AppRouter } from "./components/AppRouter";

const appElement = document.getElementById("app");
if (!appElement) throw new Error("App mount not found");
const dispose = render(
  () =>
    AppRouter({
      element: appElement,
      body: document.body as HTMLBodyElement,
      noCssWarning: document.getElementById("nocss"),
    }),
  appElement,
);

import.meta.hot?.dispose(dispose);
