import { adaptService } from "../../service-adapter";
import * as services from "../../../services/operations/user/tags";
export const addTag = adaptService(services.addTag);
export const clearTagPb = adaptService(services.clearTagPb);
export const editTag = adaptService(services.editTag);
export const removeTag = adaptService(services.removeTag);
export const getTags = adaptService(services.getTags);
