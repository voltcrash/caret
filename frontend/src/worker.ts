import server from "./server";
import { createApplicationWorker } from "./server/worker.server";

export default createApplicationWorker(server.fetch);
