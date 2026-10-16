/**
 * Legacy `src/ts` modules SSR may import: pure standalone presentation with
 * no browser state. Root-relative globs, shared by Start import protection
 * and the source layer test.
 */
export const ssrSafeLegacyFiles = [
  "src/ts/components/standalone/StandaloneHeader.tsx",
  "src/ts/components/standalone/PrivacyPolicy.tsx",
  "src/ts/components/common/Fa.tsx",
  "src/ts/components/common/Balloon.tsx",
  "src/ts/components/common/Button.tsx",
  "src/ts/components/common/Link.tsx",
  "src/ts/components/common/Headers.tsx",
  "src/ts/components/common/ClientToggle.tsx",
  "src/ts/utils/numbers.ts",
  "src/ts/utils/cn.ts",
  "src/ts/types/**",
];
