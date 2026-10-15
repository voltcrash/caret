import { getAuthClient } from "../auth-client";

export type DeviceRequest = {
  user_code: string;
  status: string;
  client_id?: string;
  scope?: string;
};

export async function reviewDeviceCode(
  userCode: string,
): Promise<DeviceRequest> {
  const result = await getAuthClient().device({
    query: { user_code: userCode },
  });
  if (result.error !== null) throw new Error(result.error.error_description);
  const request = result.data;
  if (request === null) throw new Error("Could not load device request");
  if (request.client_id !== "oxytype-tui") {
    throw new Error("This request cannot be reviewed by this account");
  }
  return request;
}

export async function decideDeviceCode(
  userCode: string,
  decision: "approve" | "deny",
): Promise<void> {
  const result = await getAuthClient().device[decision]({ userCode });
  if (result.error !== null) throw new Error(result.error.error_description);
  if (!result.data?.success) {
    throw new Error("Could not process device request");
  }
}
