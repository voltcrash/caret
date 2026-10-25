// Named re-exports let the bundler drop unused Sentry integrations (replay,
// feedback, …); a namespace import of "@sentry/browser" keeps all of them.
export {
  browserTracingIntegration,
  captureException,
  init,
  setUser,
  thirdPartyErrorFilterIntegration,
} from "@sentry/browser";
