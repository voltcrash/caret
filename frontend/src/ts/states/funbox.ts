import { createAppSignal } from "../../app/state";
import { FunboxName } from "@oxytype/schemas/configs";

export const [getFunboxBodyClasses, setFunboxBodyClasses] = createAppSignal<
  string[]
>([]);
export const [getFunboxStylesheets, setFunboxStylesheets] = createAppSignal<
  { name: FunboxName }[]
>([]);
// Legacy activation adds this class once, and clear() never removes it.
export const [isFunboxReducedMotionIgnored, setFunboxReducedMotionIgnored] =
  createAppSignal(false);
// A fresh object restarts the scanline on repeated CRT application.
export const [getCrt, setCrt] = createAppSignal<object | null>(null);
export const [isReadAheadDisabled, setReadAheadDisabled] =
  createAppSignal(false);
export const [areWordsVisible, setWordsVisible] = createAppSignal(true);
export const [isWordsWrapperVisible, setWordsWrapperVisible] =
  createAppSignal(true);
