import { expect, vi } from "vite-plus/test";
import { AuthenticatedSession } from "../../src/utils/auth";
import * as AuthUtils from "../../src/utils/auth";

export type BearerAuthenticationMock = {
  /**
   * Reset the mock and return a default token. Call this method in the `beforeEach` of all tests.
   */
  beforeEach: () => void;
  /**
   * Reset the mock results in the authentication to fail.
   */
  noAuth: () => void;
  /**
   * verify the authentication has been called
   */
  expectToHaveBeenCalled: () => void;
  /**
   * modify the token returned by the mock. This can be used to e.g. return a stale token.
   * @param customize
   */
  modifyToken: (customize: Partial<AuthenticatedSession>) => void;
};
export function mockBearerAuthentication(
  uid: string,
): BearerAuthenticationMock {
  const mockDecodedToken = {
    uid,
    email: "newuser@mail.com",
    createdAt: new Date(),
  };
  const verifySessionMock = vi.spyOn(AuthUtils, "verifySession");

  return {
    beforeEach: (): void => {
      verifySessionMock.mockClear();
      verifySessionMock.mockResolvedValue(mockDecodedToken);
    },

    noAuth: (): void => {
      verifySessionMock.mockClear();
    },

    expectToHaveBeenCalled: (): void => {
      expect(verifySessionMock).toHaveBeenCalled();
    },

    modifyToken: (customize: Partial<AuthenticatedSession>): void => {
      verifySessionMock.mockClear();
      verifySessionMock.mockResolvedValue({
        ...mockDecodedToken,
        ...customize,
      });
    },
  };
}
