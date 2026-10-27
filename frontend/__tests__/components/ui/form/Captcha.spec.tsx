import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@solidjs/testing-library";
import { AnyFieldApi, createForm } from "@tanstack/solid-form";
import { Accessor, Setter, createSignal } from "solid-js";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

import {
  Captcha,
  TurnstileApi,
  TurnstileOptions,
} from "../../../../src/ts/components/ui/form/Captcha";
import { SubmitButton } from "../../../../src/ts/components/ui/form/SubmitButton";
import { allFieldsMandatory } from "../../../../src/ts/components/ui/form/utils";

let options: TurnstileOptions;
const api: TurnstileApi = {
  render: vi.fn((_el, settings) => {
    options = settings;
    return "widget-1";
  }),
  reset: vi.fn(),
  remove: vi.fn(),
};

function mount(): ReturnType<typeof render> & {
  value: Accessor<string>;
  setValue: Setter<string>;
} {
  const [value, setValue] = createSignal("");
  const field = {
    state: {
      get value() {
        return value();
      },
    },
    setValue,
  } as unknown as AnyFieldApi;
  const view = render(() => (
    <Captcha field={() => field} action="quote-submit" />
  ));
  return { ...view, value, setValue };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("turnstile", api);
});
afterEach(() => {
  cleanup();
  document.getElementById("turnstile-api")?.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("waits for the API and binds the form action to a component-owned widget", () => {
  const view = mount();
  expect(api.render).toHaveBeenCalledWith(
    view.container.firstElementChild?.firstElementChild,
    expect.objectContaining({
      action: "quote-submit",
      sitekey: "1x00000000000000000000AA",
      "response-field": false,
    }),
  );
  options.callback("fresh-token");
  expect(view.value()).toBe("fresh-token");
});

it("reports a rendering exception without enabling submission", () => {
  vi.mocked(api.render).mockImplementationOnce(() => {
    throw new Error("Widget configuration rejected");
  });
  const view = mount();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Turnstile verification unavailable",
  );
  expect(view.value()).toBe("");
});

it.each(["expired-callback", "timeout-callback", "error-callback"] as const)(
  "clears tokens on %s",
  (callback) => {
    const view = mount();
    options.callback("fresh-token");
    options[callback]();
    expect(view.value()).toBe("");
    expect(api.reset).not.toHaveBeenCalled(); // Turnstile owns automatic renewal.
  },
);

it("resets a consumed token when the form clears it after a request", () => {
  const view = mount();
  options.callback("spent-token");
  view.setValue("");
  expect(api.reset).toHaveBeenCalledWith("widget-1");
  options.callback("new-token");
  expect(view.value()).toBe("new-token");
});

it("removes the widget and ignores late callbacks after the modal closes", () => {
  const view = mount();
  options.callback("token");
  view.unmount();
  expect(api.remove).toHaveBeenCalledWith("widget-1");
  expect(view.value()).toBe("");
  options.callback("late-token");
  expect(view.value()).toBe("");
});

it("renders after a delayed script load, sharing one script across forms", () => {
  vi.stubGlobal("turnstile", undefined);
  delete (window as Window & { turnstile?: TurnstileApi }).turnstile;
  mount();
  const script = document.getElementById("turnstile-api");
  expect(script).toHaveAttribute(
    "src",
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
  );
  mount();
  expect(document.querySelectorAll("#turnstile-api")).toHaveLength(1);
  vi.stubGlobal("turnstile", api);
  script?.dispatchEvent(new Event("load"));
  expect(api.render).toHaveBeenCalledTimes(2);
});

it("renders an asynchronously loaded API without its incompatible ready helper", () => {
  vi.stubGlobal("turnstile", undefined);
  delete (window as Window & { turnstile?: TurnstileApi }).turnstile;
  const view = mount();
  const script = document.getElementById("turnstile-api") as HTMLScriptElement;
  expect(script.async).toBe(true);
  const ready = vi.fn(() => {
    throw new Error("Remove async/defer before using turnstile.ready()");
  });
  vi.stubGlobal("turnstile", { ...api, ready });
  script.dispatchEvent(new Event("load"));
  expect(ready).not.toHaveBeenCalled();
  expect(api.render).toHaveBeenCalledOnce();
  options.callback("fresh-token");
  expect(view.value()).toBe("fresh-token");
});

it("reports script failure and never enables submission", () => {
  vi.stubGlobal("turnstile", undefined);
  delete (window as Window & { turnstile?: TurnstileApi }).turnstile;
  const view = mount();
  document.getElementById("turnstile-api")?.dispatchEvent(new Event("error"));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Turnstile verification unavailable",
  );
  expect(view.value()).toBe("");
  expect(api.render).not.toHaveBeenCalled();
});

it("does not render into an unmounted modal when the script arrives later", () => {
  vi.stubGlobal("turnstile", undefined);
  delete (window as Window & { turnstile?: TurnstileApi }).turnstile;
  const view = mount();
  const script = document.getElementById("turnstile-api");
  view.unmount();
  vi.stubGlobal("turnstile", api);
  script?.dispatchEvent(new Event("load"));
  expect(api.render).not.toHaveBeenCalled();
});

it("reports a blocked script after the loading deadline", () => {
  vi.useFakeTimers();
  vi.stubGlobal("turnstile", undefined);
  delete (window as Window & { turnstile?: TurnstileApi }).turnstile;
  mount();
  vi.advanceTimersByTime(15_000);
  expect(screen.getByRole("alert")).toBeInTheDocument();
  expect(api.render).not.toHaveBeenCalled();
});

it("disables the real form after expiry or consumption and enables a fresh retry", async () => {
  const submissions: string[] = [];
  render(() => {
    const form = createForm(() => ({
      defaultValues: { captcha: "" },
      validators: { onChange: allFieldsMandatory() },
      onSubmit: ({ value }) => {
        submissions.push(value.captcha);
        form.setFieldValue("captcha", "");
      },
    }));
    return (
      <form
        data-testid="protected-form"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field
          name="captcha"
          children={(field) => <Captcha field={field} action="signup" />}
        />
        <SubmitButton form={form} text="submit" />
      </form>
    );
  });
  const button = screen.getByRole("button", { name: "submit" });
  expect(button).toBeDisabled();
  options.callback("first-token");
  await waitFor(() => expect(button).toBeEnabled());
  options["expired-callback"]();
  await waitFor(() => expect(button).toBeDisabled());
  options.callback("second-token");
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.submit(screen.getByTestId("protected-form"));
  await waitFor(() => expect(submissions).toEqual(["second-token"]));
  expect(api.reset).toHaveBeenCalledWith("widget-1");
  await waitFor(() => expect(button).toBeDisabled());
  options.callback("retry-token");
  await waitFor(() => expect(button).toBeEnabled());
});
