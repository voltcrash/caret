import { adaptService } from "../../service-adapter";
import * as services from "../../../services/operations/user/account";
export const createNewUser = adaptService(services.createNewUser);
export const deleteUser = adaptService(services.deleteUser);
export const resetUser = adaptService(services.resetUser);
export const updateName = adaptService(services.updateName);
export const checkName = adaptService(services.checkName);
export const revokeAllTokens = adaptService(services.revokeAllTokens);
