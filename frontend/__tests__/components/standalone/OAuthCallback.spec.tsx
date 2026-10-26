import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

import { OAuthCallback } from "../../../src/ts/components/standalone/OAuthCallback";

const postMessage = vi.fn();

beforeEach(() => {
  postMessage.mockReset();
  vi.stubGlobal("opener", { postMessage });
  vi.spyOn(window, "close").mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function mount(query: string): ReturnType<typeof render> {
  window.history.replaceState(null, "", `/oauth-callback?${query}`);
  return render(() => <OAuthCallback />);
}
it.each([null, "access_denied"])(
  "returns OAuth results to the opener at the current origin (%s)",
  (error) => {
    const { container } = mount(
      `requestId=nonce${error === null ? "" : `&error=${error}`}`,
    );
    expect(postMessage).toHaveBeenCalledWith(
      { type: "caret-auth", requestId: "nonce", error },
      window.location.origin,
    );
    expect(window.close).toHaveBeenCalledOnce();
    expect(container).toHaveTextContent(error ?? "You can close this tab");
  },
);
it("decodes callback parameters", () => {
  mount("requestId=a%2Bb&error=access+denied");
  expect(postMessage).toHaveBeenCalledWith(
    { type: "caret-auth", requestId: "a+b", error: "access denied" },
    window.location.origin,
  );
});
it("rejects a callback without a request ID", () => {
  const { container } = mount("");
  expect(container).toHaveTextContent("Sign-in request not found");
  expect(postMessage).not.toHaveBeenCalled();
  expect(window.close).not.toHaveBeenCalled();
});
it("shows the result when opened without an opener", () => {
  vi.stubGlobal("opener", null);
  const { container } = mount("requestId=nonce");
  expect(container).toHaveTextContent("You can close this tab");
});
