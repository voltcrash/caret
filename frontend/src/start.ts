import {
  createStart,
  createCsrfMiddleware,
  createMiddleware,
} from "@tanstack/solid-start";
import { ZodError } from "zod";
import { setResponseStatus } from "@tanstack/solid-start/server";
import { createServiceContext } from "./server/context.server";

const services = createMiddleware().server(
  async ({ request, next }) =>
    await next({ context: { services: createServiceContext(request) } }),
);

const functionErrors = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    try {
      return await next();
    } catch (error) {
      if (error instanceof ZodError) {
        setResponseStatus(422);
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
