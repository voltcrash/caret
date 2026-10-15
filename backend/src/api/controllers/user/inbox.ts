import { adaptService } from "../../service-adapter";
import * as services from "../../../services/operations/user/inbox";
export const getInbox = adaptService(services.getInbox);
export const updateInbox = adaptService(services.updateInbox);
