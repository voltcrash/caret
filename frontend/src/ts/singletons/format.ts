import { createAppOwned } from "../../app/application";
import { appObject } from "../../app/state";
import { Formatting } from "../utils/format";
import { peekConfig } from "../config/store";
export default appObject(createAppOwned(() => new Formatting(peekConfig())));
