import { writeFileSync, mkdirSync } from "node:fs";
import { getOpenApi } from "../src/http/openapi";

//detect if we run this as a main
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    console.error("Provide filename.");
    process.exit(1);
  }
  const outFile = args[0] as string;
  if (outFile === "--start") {
    console.log(JSON.stringify(getOpenApi("/api")));
  } else {
    //create directories if needed
    const lastSlash = outFile.lastIndexOf("/");
    if (lastSlash > 1) {
      const dir = outFile.substring(0, lastSlash);
      mkdirSync(dir, { recursive: true });
    }

    const openapi = getOpenApi();
    writeFileSync(args[0] as string, JSON.stringify(openapi, null, 2));
  }
}
