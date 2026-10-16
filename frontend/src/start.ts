import {
  createStart,
  createCsrfMiddleware,
  createMiddleware,
  createIsomorphicFn,
} from "@tanstack/solid-start";
import { ZodError } from "zod";
import { setResponseStatus } from "@tanstack/solid-start/server";
import { createServiceContext } from "./server/context.server";
import { staleFunctionResponse } from "./server/stale-functions.server";
import { serverFunctionFetch } from "./features/update/fetch.client";

const services = createMiddleware().server(
  async ({ request, handlerType, next }) =>
    await next({
      context: {
        services: createServiceContext(request, handlerType === "serverFn"),
      },
    }),
);

const staleFunctions = createMiddleware().server(
  async ({ handlerType, next }) => {
    if (handlerType !== "serverFn") return await next();
    try {
      return await next();
    } catch (error) {
      const response = staleFunctionResponse(error);
      if (response === undefined) throw error;
      return response;
    }
  },
);

const functionErrors = createMiddleware({ type: "function" }).server(
  async ({ next, context }) => {
    try {
      return await next();
    } catch (error) {
      if (error instanceof ZodError) {
        // SSR calls share the document response; only a direct call is a 422.
        if (
          (context as unknown as { services?: { rpc?: boolean } }).services?.rpc
        ) {
          setResponseStatus(422);
        }
        throw new Error("Invalid operation input");
      }
      throw error;
    }
  },
);

export const startInstance = createStart(() => ({
  functionMiddleware: [functionErrors],
  requestMiddleware: [
    services,
    createCsrfMiddleware({
      filter: ({ handlerType }) => handlerType === "serverFn",
    }),
    staleFunctions,
  ],
  serverFns: {
    fetch: createIsomorphicFn().client(serverFunctionFetch).server(fetch),
  },
}));
