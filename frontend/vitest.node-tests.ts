// These tests read source/fixtures or exercise pure Node/server APIs.
export const nodeTests = [
  "__tests__/architecture/**/*.spec.ts",
  "__tests__/scripts/**/*.spec.ts",
  "__tests__/vite-plugins/**/*.spec.ts",
  "__tests__/styles/**/*.spec.ts",
  "__tests__/utils/{colors,ip-addresses,key-converter,migration-performance,numbers,result-hash,settings-search,zod}.spec.ts",
  "__tests__/elements/**/*.spec.ts",
  "__tests__/components/pages/test/keymapConverter.spec.ts",
  "__tests__/root/critical-path.spec.ts",
  "__tests__/features/typing/event-log-transport.spec.ts",
  "__tests__/test/events/{anticheat,result-integrity}.spec.ts",
];
