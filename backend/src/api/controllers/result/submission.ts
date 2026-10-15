import { adaptService } from "../../service-adapter";
import * as services from "../../../services/operations/result/submission";
export const addResult = adaptService(services.addResult);
