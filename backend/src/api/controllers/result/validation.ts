import { adaptService } from "../../service-adapter";
import * as services from "../../../services/operations/result/validation";
export const validateSubmission = adaptService(services.validateSubmission);
