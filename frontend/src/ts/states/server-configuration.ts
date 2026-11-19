import { configurationReadiness } from "../../app/readiness";
import { Configuration } from "@caret/schemas/configuration";
import { getQueryClient } from "../../data/queries";
import { getServerConfigurationQueryOptions } from "../../data/queries/server-configuration";

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
