import { IsValidResponse } from "../types/validation";

type IsValidResponseOrFunction =
  | ((message: string) => IsValidResponse)
  | IsValidResponse;
export function remoteValidation<V, T>(
  call: (val: V) => Promise<{ status: number; data?: T; message: string }>,
  options?: {
    check?: (data: T) => IsValidResponse;
    on4xx?: IsValidResponseOrFunction;
    on5xx?: IsValidResponseOrFunction;
  },
): (val: V) => Promise<IsValidResponse> {
  return async (val) => {
    const result = await call(val);
    if (result.status <= 299) {
      return options?.check?.(result.data as T) ?? true;
    }

    let handler: IsValidResponseOrFunction | undefined;
    if (result.status <= 499) {
      handler = options?.on4xx ?? ((message) => message);
    } else {
      handler = options?.on5xx ?? "Server unavailable. Please try again later.";
    }

    if (typeof handler === "function") return handler(result.message);
    return handler;
  };
}
