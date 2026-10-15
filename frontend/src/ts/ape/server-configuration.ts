import { configurationReadiness } from "../../app/readiness";
import { Configuration } from "@oxytype/schemas/configuration";
import { getQueryClient } from "../queries";
import { getServerConfigurationQueryOptions } from "../queries/server-configuration";

export function get(): Configuration | undefined {
  return getQueryClient().getQueryData(
    getServerConfigurationQueryOptions().queryKey,
  );
}

export async function sync(): Promise<void> {
  const client = getQueryClient();
  return configurationReadiness().start(async () => {
    await client.query(getServerConfigurationQueryOptions());
  });
}
