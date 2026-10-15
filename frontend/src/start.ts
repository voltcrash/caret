import {
  createStart,
  createCsrfMiddleware,
  createMiddleware,
} from "@tanstack/solid-start";
import { createServiceContext } from "./server/context.server";

const services = createMiddleware().server(
  async ({ request, next }) =>
    await next({ context: { services: createServiceContext(request) } }),
);

export const startInstance = createStart(() => ({
  requestMiddleware: [
    services,
    createCsrfMiddleware({
      filter: ({ handlerType }) => handlerType === "serverFn",
    }),
  ],
}));
