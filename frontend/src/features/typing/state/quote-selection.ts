import { z } from "zod";
import { appSignal } from "#app/state.ts";
import { useLocalStorage } from "#shared/hooks/useLocalStorage.ts";

export const [getSelectedQuoteId, setSelectedQuoteId] = appSignal(() =>
  useLocalStorage({
    key: "selectedQuoteId",
    schema: z.number().int().min(1),
    fallback: 1,
  }),
);
