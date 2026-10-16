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

/**
 * Browser-only typing modules. Reachable solely through the client-only typing
 * leaf (`*.client.*` entry), so server import protection denies them like
 * legacy state and the layer test treats them as client code.
 */
export const clientOnlyFeatureFiles = [
  "src/features/typing/components/**",
  "src/features/typing/runtime/**",
  "src/features/typing/lifecycle.ts",
  "src/features/typing/scope.ts",
];

/**
 * Rollback-only page system (Stage 8 deletes it). Start's client build must
 * never bundle it; typing route entry/exit replaced its page lifecycle.
 */
export const rollbackOnlyFiles = [
  "src/rollback/**",
  "src/ts/controllers/page-controller.ts",
  "src/ts/components/pages/AppPages.tsx",
  "src/ts/components/core/NavigationRuntime.tsx",
  "src/ts/components/AppRouter.tsx",
  "src/ts/components/App.tsx",
  "src/ts/pages/**",
  "src/app/legacy-runtime.client.tsx",
];
