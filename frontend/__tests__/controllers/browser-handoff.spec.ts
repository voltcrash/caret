import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(async () => undefined),
  setConfig: vi.fn(),
  showModal: vi.fn(),
  quoteReport: vi.fn(),
  userReport: vi.fn(),
  error: vi.fn(),
  notice: vi.fn(),
  profile: vi.fn(async (_input?: unknown) => ({
    status: 200,
    body: { data: { name: "Tester", uid: "user" } },
  })),
}));
vi.mock("../../src/data/operations", () => ({
  operation: async (_id: string, input: unknown) => {
    const response = await mocks.profile(input);
    return { ok: true, status: 200, data: response.body.data, message: "" };
  },
}));
vi.mock("../../src/ts/config/setters", () => ({ setConfig: mocks.setConfig }));
vi.mock("../../src/ts/navigation/navigation", () => ({
  navigate: mocks.navigate,
}));
vi.mock("../../src/ts/states/modals", () => ({ showModal: mocks.showModal }));
vi.mock("../../src/ts/states/quote-report", () => ({
  showQuoteReportModal: mocks.quoteReport,
}));
vi.mock("../../src/ts/states/user-report", () => ({
  setUserToReport: mocks.userReport,
}));
vi.mock("../../src/ts/states/notifications", () => ({
  showErrorNotification: mocks.error,
  showNoticeNotification: mocks.notice,
}));

describe("terminal browser form handoff", () => {
  let load: typeof import("../../src/ts/controllers/browser-handoff").loadBrowserHandoff;
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    load = (await import("../../src/ts/controllers/browser-handoff"))
      .loadBrowserHandoff;
  });
  it("keeps the quote subject through login and opens the form once", async () => {
    await load(
      "?terminalAction=quote-report&language=french&quoteId=42",
      false,
    );
    expect(mocks.navigate).toHaveBeenCalledWith("/login");
    expect(mocks.quoteReport).not.toHaveBeenCalled();
    await load("", true);
    expect(mocks.setConfig).toHaveBeenCalledWith("language", "french", {
      nosave: true,
    });
    expect(mocks.quoteReport).toHaveBeenCalledWith(42);
    await load("", true);
    expect(mocks.quoteReport).toHaveBeenCalledTimes(1);
  });
  it("opens quote submission with the requested language", async () => {
    await load("?terminalAction=quote-submit&language=english", true);
    expect(mocks.showModal).toHaveBeenCalledWith("QuoteSubmit");
  });
  it("loads the reported profile and passes it to the browser form", async () => {
    await load("?terminalAction=user-report&username=Tester", true);
    expect(mocks.profile).toHaveBeenCalledWith({
      params: { uidOrName: "Tester" },
      query: { isUid: false, client: "web" },
    });
    expect(mocks.userReport).toHaveBeenCalledWith({
      name: "Tester",
      uid: "user",
    });
    expect(mocks.showModal).toHaveBeenCalledWith("UserReport");
  });
  it("rejects malformed links without opening forms", async () => {
    await load(
      "?terminalAction=quote-report&language=english&quoteId=-1",
      true,
    );
    expect(mocks.error).toHaveBeenCalledWith("Invalid terminal browser link");
    expect(mocks.quoteReport).not.toHaveBeenCalled();
    expect(mocks.showModal).not.toHaveBeenCalled();
  });
});
