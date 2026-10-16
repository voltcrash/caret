import type { CompletedEvent } from "@oxytype/schemas/results";
import type { ParentProps } from "solid-js";

import { cleanup, fireEvent, render } from "@solidjs/testing-library";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

import { mockHttpFixture } from "../../__harness__/operations";

const mocks = vi.hoisted(() => ({
  result: null as CompletedEvent | null,
  add: vi.fn(),
  saveLocal: vi.fn(),
  hide: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("../../../src/ts/auth-client", () => ({
  getAuthenticatedUser: () => ({ uid: "saved-user" }),
}));
vi.mock("../../../src/ts/db", () => ({ saveLocalResult: mocks.saveLocal }));
vi.mock("../../../src/ts/states/modals", () => ({ hideModal: mocks.hide }));
vi.mock("../../../src/ts/states/test", () => ({
  getLastSignedOutResult: () => mocks.result,
  setLastSignedOutResult: (result: CompletedEvent | null) => {
    mocks.result = result;
  },
}));
vi.mock("../../../src/ts/states/notifications", () => ({
  showErrorNotification: mocks.error,
  showNoticeNotification: vi.fn(),
  showSuccessNotification: mocks.success,
}));
vi.mock("../../../src/ts/components/common/AnimatedModal", () => ({
  AnimatedModal: (props: ParentProps) => <div>{props.children}</div>,
}));

import fixture from "../../../../packages/typing-core/__fixtures__/keystrokes/words-10-clean.json";
import {
  LastSignedOutResultModal,
  updateUidAndHash,
} from "../../../src/ts/components/modals/LastSignedOutResultModal";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.result = {
    ...fixture.completedEvent,
    uid: "guest",
    hash: "guest-hash",
  } as unknown as CompletedEvent;
  mocks.add.mockResolvedValue({
    status: 200,
    body: { data: { insertedId: "saved-result", isPb: true } },
  });
});
afterEach(cleanup);

describe("signed-out result saving", () => {
  it("rehashes repeatedly without including an existing hash or replacing the event", () => {
    const event = mocks.result as CompletedEvent;
    expect(updateUidAndHash("user", event)).toBe(event);
    const hash = event.hash;
    event.hash = "stale hash";
    updateUidAndHash("user", event);
    expect(event.hash).toBe(hash);
    expect(event.uid).toBe("user");
  });
  it("saves a cloned completed event with its ID and PB flag", async () => {
    const previous = mocks.result;
    const view = render(() => <LastSignedOutResultModal />);
    fireEvent.click(
      view.getAllByRole("button", { name: "save" })[0] as HTMLElement,
    );
    await vi.waitFor(() => expect(mocks.saveLocal).toHaveBeenCalledOnce());
    const saved = mocks.saveLocal.mock.calls[0]?.[0].result;
    expect(saved).toMatchObject({
      _id: "saved-result",
      uid: "saved-user",
      isPb: true,
    });
    expect(saved).not.toBe(previous);
    expect(saved.hash).not.toBe("guest-hash");
    expect(saved).not.toHaveProperty("words");
    expect(saved).not.toHaveProperty("timeTyping");
    expect(saved).not.toHaveProperty("dayTimestamp");
    expect(mocks.result).toBeNull();
    expect(mocks.success).toHaveBeenCalledWith(
      "Last test result saved (new pb!)",
    );
  });

  it("retains the result when the server rejects saving", async () => {
    mocks.add.mockResolvedValue({
      status: 500,
      body: { message: "Unavailable" },
    });
    const view = render(() => <LastSignedOutResultModal />);
    fireEvent.click(
      view.getAllByRole("button", { name: "save" })[0] as HTMLElement,
    );
    await vi.waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(mocks.saveLocal).not.toHaveBeenCalled();
    expect(mocks.result).not.toBeNull();
    expect(mocks.hide).toHaveBeenCalledWith("LastSignedOutResult");
  });
});

mockHttpFixture("results.add", async (input) => await mocks.add(input));
