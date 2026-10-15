import { Configuration } from "@oxytype/schemas/configuration";
import { promiseWithResolvers } from "../utils/misc";
import { getQueryClient } from "../queries";
import { getServerConfigurationQueryOptions } from "../queries/server-configuration";

const {
  promise: configurationPromise,
  resolve,
  reject,
} = promiseWithResolvers<boolean>();

// Startup can fail before any page starts awaiting server configuration.
void configurationPromise.catch((error: unknown) => {
  console.error("Failed to synchronize server configuration", error);
});

export { configurationPromise };

export function get(): Configuration | undefined {
  return getQueryClient().getQueryData(
    getServerConfigurationQueryOptions().queryKey,
  );
}

export async function sync(): Promise<void> {
  try {
    await getQueryClient().query(getServerConfigurationQueryOptions());
    resolve(true);
  } catch (e) {
    reject(e);
  }
}
