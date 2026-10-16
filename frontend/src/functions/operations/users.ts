import { createServerFn } from "@tanstack/solid-start";
import { callOperation } from "../../server/operation.server";
import { operationInput } from "./input";

export const usersGet = createServerFn({ method: "GET" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "users.get", data),
  );

export const usersGetCustomThemes = createServerFn({ method: "GET" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "users.getCustomThemes", data),
  );

export const usersGetInbox = createServerFn({ method: "GET" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "users.getInbox", data),
  );

export const usersGetNameAvailability = createServerFn({ method: "GET" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "users.getNameAvailability", data),
  );

export const usersGetProfile = createServerFn({ method: "GET" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "users.getProfile", data),
  );

export const usersGetTestActivity = createServerFn({ method: "GET" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "users.getTestActivity", data),
  );

export const usersAddCustomTheme = createServerFn({ method: "POST" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "users.addCustomTheme", data),
  );

export const usersAddQuoteToFavorites = createServerFn({ method: "POST" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "users.addQuoteToFavorites", data),
  );

export const usersAddResultFilterPreset = createServerFn({ method: "POST" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(
        context.services,
        "users.addResultFilterPreset",
        data,
      ),
  );

export const usersCreate = createServerFn({ method: "POST" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "users.create", data),
  );

export const usersCreateTag = createServerFn({ method: "POST" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "users.createTag", data),
  );

export const usersDelete = createServerFn({ method: "POST" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "users.delete", data),
  );

export const usersDeleteCustomTheme = createServerFn({ method: "POST" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "users.deleteCustomTheme", data),
  );

export const usersDeletePersonalBests = createServerFn({ method: "POST" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "users.deletePersonalBests", data),
  );

export const usersDeleteTag = createServerFn({ method: "POST" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "users.deleteTag", data),
  );

export const usersDeleteTagPersonalBest = createServerFn({ method: "POST" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(
        context.services,
        "users.deleteTagPersonalBest",
        data,
      ),
  );

export const usersEditCustomTheme = createServerFn({ method: "POST" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "users.editCustomTheme", data),
  );

export const usersEditTag = createServerFn({ method: "POST" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "users.editTag", data),
  );

export const usersOptOutOfLeaderboards = createServerFn({ method: "POST" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "users.optOutOfLeaderboards", data),
  );

export const usersRemoveQuoteFromFavorites = createServerFn({ method: "POST" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(
        context.services,
        "users.removeQuoteFromFavorites",
        data,
      ),
  );

export const usersRemoveResultFilterPreset = createServerFn({ method: "POST" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(
        context.services,
        "users.removeResultFilterPreset",
        data,
      ),
  );

export const usersReport = createServerFn({ method: "POST" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "users.report", data),
  );

export const usersReset = createServerFn({ method: "POST" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "users.reset", data),
  );

export const usersRevokeAllTokens = createServerFn({ method: "POST" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "users.revokeAllTokens", data),
  );

export const usersSetStreakHourOffset = createServerFn({ method: "POST" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "users.setStreakHourOffset", data),
  );

export const usersUpdateInbox = createServerFn({ method: "POST" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "users.updateInbox", data),
  );

export const usersUpdateLeaderboardMemory = createServerFn({ method: "POST" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(
        context.services,
        "users.updateLeaderboardMemory",
        data,
      ),
  );

export const usersUpdateName = createServerFn({ method: "POST" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "users.updateName", data),
  );

export const usersUpdateProfile = createServerFn({ method: "POST" })
  .validator(operationInput)
  .handler(
    async ({ context, data }) =>
      await callOperation(context.services, "users.updateProfile", data),
  );
