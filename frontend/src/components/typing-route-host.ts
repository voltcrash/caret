import { createContext, useContext, type Accessor } from "solid-js";

/** Route observation for shared chrome; the host derives it from its router. */
export const TypingRouteHost = createContext<Accessor<boolean>>(() => false);

export function useTypingRoute(): Accessor<boolean> {
  return useContext(TypingRouteHost);
}
