import { cleanup, fireEvent, render } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { LinkHost } from "../../../src/components/link-host";
import { Link } from "../../../src/ts/components/common/Link";

// Router-backed links (preload, blockers, modified clicks) are covered by
// app/navigation.spec; this covers host selection and the plain fallback.
describe("Link", () => {
  afterEach(cleanup);

  it("renders a plain anchor outside the app layout", () => {
    const onClick = vi.fn((event: MouseEvent) => event.preventDefault());
    const { getByText } = render(() => (
      <Link href="/settings" class="text-sub" onClick={onClick}>
        settings
      </Link>
    ));
    const anchor = getByText("settings");
    fireEvent.click(anchor);
    expect(onClick).toHaveBeenCalledOnce();
    expect(anchor).toHaveAttribute("href", "/settings");
    expect(anchor).toHaveClass("text-sub");
    expect(anchor).not.toHaveAttribute("router-link");
  });

  it("delegates to the layout's link host", () => {
    const host = vi.fn((props: { href?: string; class?: string }) => (
      <b data-href={props.href} class={props.class} />
    ));
    const { container } = render(() => (
      <LinkHost.Provider value={host}>
        <Link href="/login" class="text-main" />
      </LinkHost.Provider>
    ));
    expect(host).toHaveBeenCalledOnce();
    expect(container.querySelector("b")).toHaveAttribute("data-href", "/login");
    expect(container.querySelector("b")).toHaveClass("text-main");
  });
});
