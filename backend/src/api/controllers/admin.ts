import { adaptService } from "../service-adapter";
import * as services from "../../services/operations/admin";
export const test = adaptService(services.test);
export const toggleBan = adaptService(services.toggleBan);
export const clearStreakHourOffset = adaptService(
  services.clearStreakHourOffset,
);
export const deleteUser = adaptService(services.deleteUser);
export const acceptReports = adaptService(services.acceptReports);
export const rejectReports = adaptService(services.rejectReports);
export const clearSuspicious = adaptService(services.clearSuspicious);
export const getAnticheatAudits = adaptService(services.getAnticheatAudits);
export const getAnticheatSummary = adaptService(services.getAnticheatSummary);
