import request from "supertest";
import { dispatchApi } from "./http-worker";
import { requestListener } from "./node-listener";
import { newId } from "../../src/utils/id";
import { BearerAuthenticationMock, mockBearerAuthentication } from "./auth";
import { beforeEach } from "vite-plus/test";
import TestAgent from "supertest/lib/agent";

export function setup(): {
  mockApp: TestAgent;
  uid: string;
  mockAuth: BearerAuthenticationMock;
} {
  // The same backend handlers Start serves under /api; see http-worker.
  const mockApp = request(requestListener(dispatchApi));
  const uid = newId();
  const mockAuth = mockBearerAuthentication(uid);

  beforeEach(() => {
    mockAuth.beforeEach();
  });

  return { mockApp, uid, mockAuth };
}
