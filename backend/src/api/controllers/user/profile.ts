import { adaptService } from "../../service-adapter";
import * as services from "../../../services/operations/user/profile";
export const getProfile = adaptService(services.getProfile);
export const updateProfile = adaptService(services.updateProfile);
