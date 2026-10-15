import { createAppOwned } from "../../app/application";
import { appObject } from "../../app/state";
import { Formatting } from "../utils/format";
import { getMutableConfig } from "../config/store";
export default appObject(
  createAppOwned(() => new Formatting(getMutableConfig())),
);
