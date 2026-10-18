import { captureAccount } from "../app/account-scope";
import { envConfig } from "virtual:env-config";

async function getSentry(): Promise<typeof import("@sentry/browser")> {
  return await import("@sentry/browser");
}

let debug = false;

let activated = false;
let generation = 0;
let client: ReturnType<typeof import("@sentry/browser").init> | undefined;

export async function activateSentry(): Promise<void> {
  const dsn = envConfig.sentryDsn;
  if (dsn === undefined || dsn === "") return;
  if (activated) {
    console.warn("Sentry already activated");
    return;
  }
  activated = true;
  console.log("Activating Sentry");

  const current = generation;
  const Sentry = await getSentry();
  if (current !== generation) return;
  client = Sentry.init({
    release: envConfig.clientVersion,
    dsn,
    // Preserve sendDefaultPii: false; Sentry 11 otherwise collects more data.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: {
        request: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
        response: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
      },
      httpBodies: [],
      urlQueryParams: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      graphQL: { document: false, variables: false },
      frameContextLines: 7,
    },
    environment: envConfig.isDevelopment ? "development" : "production",
    integrations: [
      Sentry.browserTracingIntegration(),
      // // Sentry.replayIntegration({
      // //   unmask: ["#notificationCenter"],
      // //   block: ["#commandLine .modal .suggestions"],
      // //   // ignore: ["#wordsInput"],
      // }),
      Sentry.thirdPartyErrorFilterIntegration({
        filterKeys: ["oxytype-frontend"],
        // Defines how to handle errors that contain third party stack frames.
        // Possible values are:
        // - 'drop-error-if-contains-third-party-frames'
        // - 'drop-error-if-exclusively-contains-third-party-frames'
        // - 'apply-tag-if-contains-third-party-frames'
        // - 'apply-tag-if-exclusively-contains-third-party-frames'
        behaviour: "drop-error-if-contains-third-party-frames",
      }),
    ],
    // Tracing
    tracesSampleRate: 0.25, //  Capture 100% of the transactions
    // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
    tracePropagationTargets: [
      new URL(envConfig.backendUrl, window.location.origin).href,
    ],
    // Session Replay
    replaysSessionSampleRate: 0, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
    replaysOnErrorSampleRate: 0.5, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
    ignoreErrors: [
      /**
       * Thrown when firefox prevents an add-on from refrencing a DOM element that has been removed.
       * This can also be filtered by enabling the browser extension inbound filter
       */
      "TypeError: can't access dead object",
      /**
       * React internal error thrown when something outside react modifies the DOM
       * This is usually because of a browser extension or Chrome's built-in translate
       */
      "NotFoundError: Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.",
      "NotFoundError: Failed to execute 'insertBefore' on 'Node': The node before which the new node is to be inserted is not a child of this node.",
      "Error: There is no clipping info for given tab",
      "Non-Error promise rejection captured",
      "Object captured as promise rejection",
    ],
    beforeSend(event) {
      if (envConfig.isDevelopment) {
        console.debug(
          "Sentry beforeSend, not sending in development mode",
          event,
        );
        return null;
      } else {
        if (debug) {
          console.debug("Sentry beforeSend", event);
        }
      }

      return event;

      //   console.log(
      //     "BEFORE SEND FRAMES",
      //     event.exception?.values?.[0]?.stacktrace?.frames
      //   );
      //   if (
      //     event.exception !== undefined &&
      //     event.exception.values !== undefined &&
      //     event.exception.values.length > 0
      //   ) {
      //     const exception = event.exception.values[0];
      //     if (exception && exception.stacktrace) {
      //       console.log(exception);
      //       const frames = exception.stacktrace.frames;
      //       for (const frame of frames ?? []) {
      //         if (frame.filename && frame.filename.includes("oxytype")) {
      //           // return event;
      //         }
      //       }
      //     }
      //   }
      //   return null;
    },
    beforeBreadcrumb(breadcrumb, _hint) {
      if (breadcrumb.category === "console" && breadcrumb.level === "debug") {
        return null;
      }
      return breadcrumb;
    },
  });
}

export async function setUser(uid: string, name: string): Promise<void> {
  if (!activated) return;
  const lease = captureAccount();
  const Sentry = await getSentry();
  if (!lease.isCurrent()) return;
  Sentry.setUser({
    id: uid,
    username: name,
  });
}

export async function clearUser(): Promise<void> {
  if (!activated) return;
  const lease = captureAccount();
  const Sentry = await getSentry();
  if (!lease.isCurrent()) return;
  Sentry.setUser(null);
}

export async function captureException(error: Error): Promise<void> {
  if (!activated) return;
  const Sentry = await getSentry();
  Sentry.captureException(error);
}

export function toggleDebug(): void {
  debug = !debug;
  console.debug("Sentry debug mode:", debug);
}

export function disposeSentry(): void {
  generation++;
  activated = false;
  const previous = client;
  client = undefined;
  void previous?.close(2000);
}
