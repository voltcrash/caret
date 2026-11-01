import { expect, it, vi } from "vite-plus/test";
import { activateWhatsAccepted, setAcceptedCookies } from "../src/ts/cookies";
import {
  activateAnalytics,
  deactivateAnalytics,
} from "../src/ts/controllers/analytics-controller";
import { activateSentry, disposeSentry } from "../src/ts/sentry";

vi.mock("../src/ts/controllers/analytics-controller", () => ({
  activateAnalytics: vi.fn(),
  deactivateAnalytics: vi.fn(),
}));
vi.mock("../src/ts/sentry", () => ({
  activateSentry: vi.fn(),
  disposeSentry: vi.fn(),
}));

it("stops active integrations when consent is withdrawn and allows opting in again", () => {
  vi.clearAllMocks();
  setAcceptedCookies({ security: true, analytics: true, sentry: true });
  activateWhatsAccepted();
  expect(activateAnalytics).toHaveBeenCalledOnce();
  expect(activateSentry).toHaveBeenCalledOnce();
  setAcceptedCookies({ security: true, analytics: false, sentry: false });
  activateWhatsAccepted();
  expect(deactivateAnalytics).toHaveBeenCalledOnce();
  expect(disposeSentry).toHaveBeenCalledOnce();
  setAcceptedCookies({ security: true, analytics: true, sentry: true });
  activateWhatsAccepted();
  expect(activateSentry).toHaveBeenCalledTimes(2);
});
