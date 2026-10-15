import { adaptService } from "../service-adapter";
import * as services from "../../services/operations/psa";
export const getPsas = adaptService(services.getPsas);
