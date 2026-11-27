import { describe, it } from "vite-plus/test";
import { RuleTester } from "vite-plus/lint/plugins-dev";
import plugin from "../plugins/caret-rules.js";

RuleTester.describe = describe;
RuleTester.it = it;

const message =
  "Module-level mutable state outlives the mounted app. Use createAppOwned, createAppSignal or createBinding.";

new RuleTester().run("no-module-let", plugin.rules["no-module-let"], {
  valid: [
    "const value = 1;",
    "const lookup = new Set(['a']);",
    "const [value] = createAppSignal(0);",
    "function Component() { const [value] = createSignal(0); let count = 0; }",
  ],
  invalid: [
    "let count = 0;",
    "export var count = 0;",
    "const [value, setValue] = createSignal(0);",
    "export const [store, setStore] = createStore({});",
    "const state = createMutable({});",
  ].map((code) => ({ code, errors: [{ message }] })),
});
