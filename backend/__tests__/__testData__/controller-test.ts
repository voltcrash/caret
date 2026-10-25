import { dispatchApi } from "./http-worker";
import { createTestClient, type TestClient } from "./test-client";
import { newId } from "../../src/utils/id";
import { BearerAuthenticationMock, mockBearerAuthentication } from "./auth";
import { beforeEach } from "vite-plus/test";

export function setup(): {
  mockApp: TestClient;
  uid: string;
  mockAuth: BearerAuthenticationMock;
} {
  // The same backend handlers Start serves under /api; see http-worker.
  const mockApp = createTestClient(dispatchApi);
  const uid = newId();
  const mockAuth = mockBearerAuthentication(uid);

  beforeEach(() => {
    mockAuth.beforeEach();
  });

  return { mockApp, uid, mockAuth };
}
