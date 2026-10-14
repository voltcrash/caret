import { cleanup, render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, expect, it } from "vite-plus/test";

import { TextContent } from "../../../src/ts/components/common/TextContent";
import { MessageContent } from "../../../src/ts/types/message-content";

afterEach(cleanup);

it.each(["<script>alert(1)</script>", '<img src="x" onerror="alert(1)">'])(
  "renders lines containing %s as text",
  (input) => {
    const view = render(() => <TextContent content={[input, "", "last"]} />);
    expect(view.container.textContent).toBe(`${input}last`);
    expect(view.container.querySelector("script, img")).toBeNull();
    expect(view.container.querySelectorAll("br")).toHaveLength(2);
  },
);

it("updates between a plain message and lines, preserving empty lines", () => {
  const [content, setContent] = createSignal<MessageContent>("plain");
  const view = render(() => <TextContent content={content()} />);
  expect(view.container.textContent).toBe("plain");
  setContent(["", "middle", ""]);
  expect(view.container.textContent).toBe("middle");
  expect(view.container.querySelectorAll("br")).toHaveLength(2);
  setContent("updated");
  expect(view.container.textContent).toBe("updated");
  expect(view.container.querySelector("br")).toBeNull();
});
