/**
 * list of deferred callbacks to be executed once we reached ready state
 */
/* oxlint-disable caret-rules/no-module-let -- DOM readiness belongs to the document, not an app mount. */
let readyList: (() => void)[] | undefined;
let isReady = false;
/* oxlint-enable caret-rules/no-module-let */

/**
 * Execute a callback function when the DOM is fully loaded.
 * Tries to mimic the ready function of jQuery https://github.com/jquery/jquery/blob/main/src/core/ready.js
 * If the document is already loaded, the callback is executed in the next event loop
 */
export function onDOMReady(callback: () => void): void {
  bindReady();
  if (isReady) {
    setTimeout(callback);
  } else {
    readyList?.push(callback);
  }
}

/**
 * initialize the readyList and bind the necessary events
 */
function bindReady(): void {
  // do nothing if we are bound already
  if (readyList !== undefined) return;

  readyList = [];

  if (document.readyState !== "loading") {
    // DOM is already loaded handle ready in the next event loop
    // Handle it asynchronously to allow scripts the opportunity to delay ready
    setTimeout(handleReady);
  } else {
    // register a single event listener for both events.
    document.addEventListener("DOMContentLoaded", handleReady);
    //load  event is used as a fallback "that will always work" according to jQuery source code
    window.addEventListener("load", handleReady);
  }
}

/**
 * call all deferred ready callbacks and cleanup the event listener
 */
function handleReady(): void {
  //make sure we only run once
  if (isReady) return;

  isReady = true;

  //cleanup event listeners that are no longer needed
  document.removeEventListener("DOMContentLoaded", handleReady);
  window.removeEventListener("load", handleReady);

  //call deferred callbacks and empty the list
  //flush the list in a loop in case callbacks were added during the execution
  while (readyList !== undefined && readyList.length > 0) {
    const callbacks = readyList;
    readyList = [];
    callbacks.forEach((it) => {
      //jQuery lets the callbacks fail independently
      try {
        it();
      } catch (e) {
        setTimeout(() => {
          throw e;
        });
      }
    });
  }
  readyList = undefined;
}

export const __testing = {
  resetReady: () => {
    isReady = false;
    readyList = undefined;
  },
};
