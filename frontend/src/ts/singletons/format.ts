import { Formatting } from "../utils/format";
import { getMutableConfig } from "../config/store";
export default new Formatting(getMutableConfig());
