import { getBrowserEngine } from "./engine.client";
import type {
  PolicyQuery,
  PolicyResponse,
} from "@oxytype/typing-engine/browser.client";
import type { ConfigValue, FunboxName, Config } from "@oxytype/schemas/configs";

export function enginePolicy<Q extends PolicyQuery>(
  query: Q,
): Extract<PolicyResponse, { op: Q["op"] }> {
  return getBrowserEngine().api().policy(query);
}
export function enginePolicyReady(): boolean {
  return getBrowserEngine().status().state === "ready";
}
export function checkCompatibility(
  names: FunboxName[],
  withFunbox?: FunboxName,
): boolean {
  if (names.length === 0 && withFunbox === undefined) {
    return true;
  }
  if (!enginePolicyReady()) {
    return false;
  }
  return enginePolicy({
    op: "compatible",
    names: withFunbox === undefined ? names : [...names, withFunbox],
  }).result;
}
export function checkForcedConfig(
  key: string,
  value: ConfigValue,
  names: FunboxName[],
): Extract<PolicyResponse, { op: "forced" }>["result"] {
  if (names.length === 0) {
    return { result: true };
  }
  return enginePolicy({ op: "forced", key, value, names }).result;
}
export function canSetConfigWithCurrentFunboxes(
  key: string,
  value: ConfigValue,
  names: FunboxName[] = [],
): boolean {
  // No selected constraints: preference bootstrap can complete independently of
  // engine download. Full imports apply funboxes last; activation waits for Rust.
  if (names.length === 0) {
    return true;
  }
  if (!enginePolicyReady()) {
    return false;
  }
  return enginePolicy({ op: "canSet", key, value, names }).result;
}
export type FunboxConfigError = { key: string; value: ConfigValue };
export function canSetFunboxWithConfig(
  name: FunboxName,
  config: Config,
): { ok: true } | { ok: false; errors: FunboxConfigError[] } {
  const result = enginePolicy({
    op: "settingConflicts",
    names: [...config.funbox, name],
    values: Object.entries(config),
  });
  const values: Record<string, ConfigValue> = config;
  return result.keys.length === 0
    ? { ok: true }
    : {
        ok: false,
        errors: result.keys.map((key) => ({
          key,
          value: values[key] as ConfigValue,
        })),
      };
}
