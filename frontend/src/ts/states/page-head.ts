import { createAppSignal } from "../../app/state";

export const [getOpenGraphUrl, setOpenGraphUrl] = createAppSignal<string>();
export const [getPageTitle, setPageTitle] = createAppSignal<string>();
