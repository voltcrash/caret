import { adaptService } from "../../service-adapter";
import * as services from "../../../services/operations/user/themes";
export const getCustomThemes = adaptService(services.getCustomThemes);
export const addCustomTheme = adaptService(services.addCustomTheme);
export const removeCustomTheme = adaptService(services.removeCustomTheme);
export const editCustomTheme = adaptService(services.editCustomTheme);
