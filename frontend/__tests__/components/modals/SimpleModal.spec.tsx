import type { ParentProps } from "solid-js";

import { cleanup, fireEvent, render, waitFor } from "@solidjs/testing-library";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { z } from "zod/v3";

vi.mock("../../../src/ts/components/common/AnimatedModal", () => ({
  AnimatedModal: (props: ParentProps) => <div>{props.children}</div>,
}));
vi.mock("../../../src/ts/states/modals", () => ({
  showModal: vi.fn(),
  hideModal: vi.fn(),
}));
vi.mock("../../../src/ts/states/notifications", () => ({
  addNotificationWithLevel: vi.fn(),
  showErrorNotification: vi.fn(),
  showNoticeNotification: vi.fn(),
}));
vi.mock("../../../src/ts/states/loader-bar", () => ({
  hideLoaderBar: vi.fn(),
  showLoaderBar: vi.fn(),
}));

import {
  SimpleModal,
  convertFn,
} from "../../../src/ts/components/modals/SimpleModal";
import { showSimpleModal } from "../../../src/ts/states/simple-modal";
afterEach(cleanup);

it.each(["<script>alert(1)</script>", '<img src="x" onerror="alert(1)">'])(
  "renders modal input as text: %s",
  (text) => {
    showSimpleModal({
      title: "Message",
      text,
      execFn: async () => ({ status: "success", showNotification: false }),
    });
    const view = render(() => <SimpleModal />);
    expect(view.container.textContent).toContain(text);
    expect(view.container.querySelector("script, img")).toBeNull();
  },
);

it("converts wrapped number, boolean and date schemas and preserves invalid values", () => {
  const number = convertFn<number>(
    { type: "number", preprocess: (value) => value * 2 },
    z.number().min(0).optional(),
  );
  expect(number("2.5")).toBe(5);
  expect(number("-2")).toBe(-4);
  expect(number("invalid")).toBeNaN();
  const boolean = convertFn<boolean>(
    { type: "checkbox", label: "enabled" },
    z.boolean(),
  );
  expect(boolean("1")).toBe(true);
  expect(boolean("false")).toBe(false);
  expect(boolean(true)).toBe(true);
  expect(convertFn<Date>({ type: "date" }, z.date())("2024-01-02")).toEqual(
    new Date("2024-01-02"),
  );
});

it("submits converted fields through the configured callback", async () => {
  const execFn = vi.fn(async () => ({
    status: "success" as const,
    showNotification: false as const,
  }));
  showSimpleModal({
    title: "Settings",
    schema: z.object({
      name: z.string(),
      amount: z.number(),
      enabled: z.boolean(),
    }),
    inputs: {
      name: { type: "text", initVal: "initial", label: "name" },
      amount: { type: "number", initVal: 2, label: "amount" },
      enabled: { type: "checkbox", label: "enabled", initVal: true },
    },
    buttonText: "apply",
    buttonAlwaysEnabled: true,
    execFn,
  });
  const view = render(() => <SimpleModal />);
  fireEvent.input(view.getByRole("textbox"), { target: { value: "updated" } });
  fireEvent.input(view.getByRole("spinbutton"), { target: { value: "3.5" } });
  fireEvent.click(view.getByRole("button", { name: "apply" }));
  await waitFor(() =>
    expect(execFn).toHaveBeenCalledExactlyOnceWith({
      name: "updated",
      amount: 3.5,
      enabled: true,
    }),
  );
});
