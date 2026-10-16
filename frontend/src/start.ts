import {
  createStart,
  createCsrfMiddleware,
  createMiddleware,
} from "@tanstack/solid-start";
import { ZodError } from "zod";
import { setResponseStatus } from "@tanstack/solid-start/server";
import { createServiceContext } from "./server/context.server";

const services = createMiddleware().server(
  async ({ request, handlerType, next }) =>
    await next({
      context: {
        services: createServiceContext(request, handlerType === "serverFn"),
      },
    }),
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
  ],
}));
