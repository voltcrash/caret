import { adaptService } from "../../service-adapter";
import * as services from "../../../services/operations/user/data";
export const getUser = adaptService(services.getUser);
export const getPersonalBests = adaptService(services.getPersonalBests);
export const getStats = adaptService(services.getStats);
