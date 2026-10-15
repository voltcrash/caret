/** Explicit browser-safe configuration; never spread runtime or loadEnv values. */
export const publicEnv = {
  origin: "https://oxytype.voltcrash.com",
  offline: import.meta.env.OXYTYPE_OFFLINE,
} as const;
