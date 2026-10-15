import { cleanup, fireEvent, render, waitFor } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const { review, decide } = vi.hoisted(() => ({
  review: vi.fn(),
  decide: vi.fn(),
}));
const [user, setUser] = createSignal<{
  uid: string;
  displayName: string;
} | null>({ uid: "one", displayName: "Tester" });
vi.mock("../../../../src/features/auth/state.client", () => ({
  getAuthenticatedUser: () => user(),
}));
vi.mock("../../../../src/ts/ape/device-auth", () => ({
  reviewDeviceCode: review,
  decideDeviceCode: decide,
}));

import { DeviceApproval } from "../../../../src/ts/components/pages/device/DeviceApproval";

beforeEach(() => {
  setUser({ uid: "one", displayName: "Tester" });
  review.mockReset().mockResolvedValue({
    user_code: "ABCDEFGH",
    client_id: "oxytype-tui",
    status: "pending",
  });
  decide.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("terminal consent", () => {
  it("prefills the query code but waits for explicit review and approval", async () => {
    const screen = render(() => <DeviceApproval initialCode="abcdefgh" />);
    expect(screen.getByRole("textbox")).toHaveValue("abcdefgh");
    expect(review).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "approve" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "continue" }));
    await screen.findByRole("button", { name: "approve" });
    expect(review).toHaveBeenCalledWith("ABCDEFGH");
    expect(screen.getByText("ABCDEFGH")).toBeVisible();
    expect(screen.getByText("Tester")).toBeVisible();
    expect(decide).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "approve" }));
    await screen.findByText(/Terminal authorized/);
    expect(decide).toHaveBeenCalledWith("ABCDEFGH", "approve");
    expect(screen.queryByRole("button", { name: "approve" })).toBeNull();
  });
  it("denies without creating an approved session", async () => {
    const screen = render(() => <DeviceApproval initialCode="ABCDEFGH" />);
    fireEvent.click(screen.getByRole("button", { name: "continue" }));
    fireEvent.click(await screen.findByRole("button", { name: "deny" }));
    await screen.findByText(/Request denied/);
    expect(decide).toHaveBeenCalledWith("ABCDEFGH", "deny");
  });
  it("accepts manually entered codes", async () => {
    const screen = render(() => <DeviceApproval />);
    expect(screen.getByRole("button", { name: "continue" })).toBeDisabled();
    fireEvent.input(screen.getByRole("textbox"), {
      target: { value: "abcdefgh" },
    });
    fireEvent.click(screen.getByRole("button", { name: "continue" }));
    await screen.findByRole("button", { name: "approve" });
    expect(review).toHaveBeenCalledWith("ABCDEFGH");
  });
  it("shows expired-code errors and permits another attempt", async () => {
    review.mockRejectedValueOnce(new Error("User code expired"));
    const screen = render(() => <DeviceApproval initialCode="ABCDEFGH" />);
    fireEvent.click(screen.getByRole("button", { name: "continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "User code expired",
    );
    expect(screen.getByRole("button", { name: "continue" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "continue" }));
    await screen.findByRole("button", { name: "approve" });
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("blocks duplicate decisions while a request is pending and reports failure", async () => {
    const pending = Promise.withResolvers<undefined>();
    decide.mockReturnValue(pending.promise);
    const screen = render(() => <DeviceApproval initialCode="ABCDEFGH" />);
    fireEvent.click(screen.getByRole("button", { name: "continue" }));
    fireEvent.click(await screen.findByRole("button", { name: "approve" }));
    fireEvent.click(screen.getByRole("button", { name: "approve" }));
    expect(decide).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "deny" })).toBeDisabled();
    pending.reject(new Error("Request already processed"));
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "approve" })).toBeEnabled();
  });
  it("discards a late review after the account changes", async () => {
    const pending = Promise.withResolvers<{ status: string }>();
    review.mockReturnValue(pending.promise);
    const screen = render(() => <DeviceApproval initialCode="ABCDEFGH" />);
    fireEvent.click(screen.getByRole("button", { name: "continue" }));
    setUser({ uid: "two", displayName: "Other" });
    pending.resolve({ status: "pending" });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "continue" })).toBeEnabled(),
    );
    expect(screen.queryByRole("button", { name: "approve" })).toBeNull();
    expect(decide).not.toHaveBeenCalled();
  });
});
