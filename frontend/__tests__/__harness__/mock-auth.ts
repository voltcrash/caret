import { vi } from "vite-plus/test";
vi.mock("../../src/ts/auth-client", () => ({
  getAuthenticatedUser: () => null,
  isAuthAvailable: () => false,
  authPromise: Promise.resolve(),
  observeAuthSession: () => () => undefined,
  oauthRequestEvent: { subscribe: () => () => undefined, dispatch: vi.fn() },
  signOut: vi.fn(),
  getAuthClient: () => ({}),
  checkAuthResult: vi.fn(),
  refreshSession: vi.fn(),
  requestOAuth: vi.fn(),
  updateProfile: vi.fn(),
  setUserState: vi.fn(),
  deleteUnfinishedUser: vi.fn(),
  resetIgnoreAuthCallback: vi.fn(),
  signInWithPopup: vi.fn(),
}));
