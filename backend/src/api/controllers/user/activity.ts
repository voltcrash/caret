import { adaptService } from "../../service-adapter";
import * as services from "../../../services/operations/user/activity";
export const setStreakHourOffset = adaptService(services.setStreakHourOffset);
export { generateCurrentTestActivity } from "../../../services/operations/user/activity";
export const getTestActivity = adaptService(services.getTestActivity);
export const getCurrentTestActivity = adaptService(
  services.getCurrentTestActivity,
);
export const getStreak = adaptService(services.getStreak);
