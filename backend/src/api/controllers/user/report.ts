import { adaptService } from "../../service-adapter";
import * as services from "../../../services/operations/user/report";
export const reportUser = adaptService(services.reportUser);
