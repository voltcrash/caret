import { adaptService } from "../service-adapter";
import * as services from "../../services/operations/dev";
export const createTestData = adaptService(services.createTestData);
export const addDebugInboxItem = adaptService(services.addDebugInboxItem);
