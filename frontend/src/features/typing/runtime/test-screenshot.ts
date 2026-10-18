import { captureTypingRoute } from "../scope";
import { createCroppedScreenshot } from "../components/result/useScreenshotCanvas";
import { showLoaderBar, hideLoaderBar } from "../../../ts/states/loader-bar";
import * as Replay from "./replay";
import { setIsScreenshotting } from "../../../ts/states/core";
import { getActiveFunboxesWithFunction } from "./funbox/list";
import * as DB from "../../../ts/db";
import { format } from "date-fns/format";
import {
  showNoticeNotification,
  showErrorNotification,
  showSuccessNotification,
} from "../../../ts/states/notifications";
import { convertRemToPixels } from "../../../ts/utils/numbers";
import {
  getResultWrapperElement,
  resultState,
  setScreenshotWatermark,
} from "../../../ts/states/result";
import { getTheme } from "../../../ts/states/theme";
import { download as downloadFile } from "../../../ts/components/common/Download";

function revert(): void {
  setIsScreenshotting(false);
  hideLoaderBar();
  for (const fb of getActiveFunboxesWithFunction("applyGlobalCSS")) {
    fb.functions.applyGlobalCSS();
  }
}

let firefoxClipboardNotificationShown = false;

/**
 * Prepares UI, generates screenshot canvas using modern-screenshot, and reverts UI changes.
 * Returns the generated canvas element or null on failure.
 * Handles its own loader and basic error notifications for canvas generation.
 */
async function generateCanvas(): Promise<HTMLCanvasElement | null> {
  const lease = captureTypingRoute();
  const { domToCanvas } = await import("modern-screenshot");
  if (!lease.isCurrent()) return null;
  showLoaderBar(true);

  if (resultState.replay.visible) {
    Replay.pauseReplay();
  }

  // --- UI Preparation ---
  // Result components hide buttons, login tip, replay and highlights,
  // and show the watermark while screenshotting.
  const dateNow = new Date(Date.now());
  const snapshot = DB.getSnapshot();
  setScreenshotWatermark({
    date: format(dateNow, "dd MMM yyyy HH:mm"),
    user:
      snapshot?.name !== undefined
        ? { name: snapshot.name, flags: snapshot }
        : undefined,
  });

  setIsScreenshotting(true);

  for (const fb of getActiveFunboxesWithFunction("clearGlobal")) {
    fb.functions.clearGlobal();
  }

  window.scrollTo({ top: 0, behavior: "auto" });

  // --- Target Element Calculation ---
  const src = getResultWrapperElement();
  if (src === undefined) {
    console.error("Result wrapper not found for screenshot");
    showErrorNotification("Screenshot target element not found");
    revert();
    return null;
  }
  // Wait a frame to ensure all UI changes are rendered
  await new Promise((resolve) => requestAnimationFrame(resolve));

  if (!lease.isCurrent()) return null;
  const sourceX = src.getBoundingClientRect().left ?? 0;
  const sourceY = src.getBoundingClientRect().top ?? 0;

  const style = getComputedStyle(src);
  const bounds = src.getBoundingClientRect();
  const sourceWidth =
    bounds.width + parseFloat(style.marginLeft) + parseFloat(style.marginRight);
  const sourceHeight =
    bounds.height +
    parseFloat(style.marginTop) +
    parseFloat(style.marginBottom);
  const paddingX = convertRemToPixels(2);
  const paddingY = convertRemToPixels(2);

  try {
    // Compute full-document render size to keep the target area in frame on small viewports
    const root = document.documentElement;
    const { scrollWidth, clientWidth, scrollHeight, clientHeight } = root;
    const targetWidth = Math.max(scrollWidth, clientWidth);
    const targetHeight = Math.max(scrollHeight, clientHeight);

    // Target the HTML root to include .customBackground
    const fullCanvas = await domToCanvas(root, {
      backgroundColor: getTheme().bg,
      // Sharp output
      scale: window.devicePixelRatio ?? 1,
      style: {
        width: `${targetWidth}px`,
        height: `${targetHeight}px`,
        overflow: "hidden", // for scrollbar in small viewports
      },
      // Fetch (for custom background URLs)
      fetch: {
        requestInit: { mode: "cors", credentials: "omit" },
        bypassingCache: true,
      },

      // skipping hidden elements (THAT IS SO IMPORTANT!)
      filter: (el: Node): boolean => {
        if (!(el instanceof HTMLElement)) return true;
        const cs = getComputedStyle(el);
        return !(el.matches(".hidden") || cs.display === "none");
      },
      // Normalize the background layer so its negative z-index doesn't get hidden
      onCloneEachNode: (cloned) => {
        if (cloned instanceof HTMLElement) {
          const el = cloned;
          if (el.matches(".customBackground")) {
            el.style.zIndex = "0";
            el.style.width = `${targetWidth}px`;
            el.style.height = `${targetHeight}px`;
            // for the inner image scales
            const img = el.querySelector("img");
            if (img) {
              // (<= 720px viewport width) wpm & acc text wrapper!!
              if (window.innerWidth <= 720) {
                img.style.transform = "translateY(20vh)";
                img.style.height = "100%";
              } else {
                img.style.width = "100%"; // safety nothing more
                img.style.height = "100%"; // for image fit full screen even when words history is opened with many lines
              }
            }
          }
        }
      },
    });

    if (!lease.isCurrent()) return null;
    // Scale and create output canvas
    const scale = fullCanvas.width / targetWidth;
    const paddedWidth = sourceWidth + paddingX * 2;
    const paddedHeight = sourceHeight + paddingY * 2;

    const scaledPaddedWCanvas = Math.round(paddedWidth * scale);
    const scaledPaddedHCanvas = Math.round(paddedHeight * scale);
    const scaledPaddedWForCrop = Math.ceil(paddedWidth * scale);
    const scaledPaddedHForCrop = Math.ceil(paddedHeight * scale);

    // Calculate crop coordinates with proper clamping
    const cropX = Math.max(0, Math.floor((sourceX - paddingX) * scale));
    const cropY = Math.max(0, Math.floor((sourceY - paddingY) * scale));
    const cropW = Math.min(scaledPaddedWForCrop, fullCanvas.width - cropX);
    const cropH = Math.min(scaledPaddedHForCrop, fullCanvas.height - cropY);

    return createCroppedScreenshot({
      source: fullCanvas,
      width: scaledPaddedWCanvas,
      height: scaledPaddedHCanvas,
      x: cropX,
      y: cropY,
      cropWidth: cropW,
      cropHeight: cropH,
    });
  } catch (e) {
    showErrorNotification("Error creating screenshot canvas", { error: e });
    return null;
  } finally {
    if (lease.isCurrent()) revert(); // Route exit also resets screenshot state.
  }
}

/**
 * Generates screenshot and attempts to copy it to the clipboard.
 * Falls back to opening in a new tab if clipboard access fails.
 * Handles notifications related to the copy action.
 * (This function should be used by the 'copy' command or the original button)
 */
export async function copyToClipboard(): Promise<void> {
  const canvas = await generateCanvas();
  if (!canvas) {
    // Error notification handled by generateScreenshotCanvas
    return;
  }

  canvas.toBlob(async (blob) => {
    if (!blob) {
      showErrorNotification("Failed to generate image data (blob is null)");
      return;
    }
    try {
      // Attempt to copy using ClipboardItem API
      // oxlint-disable-next-line compat/compat -- ClipboardItem failures are caught and shown as a notification.
      const clipItem = new ClipboardItem(
        Object.defineProperty({}, blob.type, {
          value: blob,
          enumerable: true,
        }),
      );
      await navigator.clipboard.write([clipItem]);
      showSuccessNotification("Copied screenshot to clipboard", {
        durationMs: 2000,
      });
    } catch (e) {
      // Handle clipboard write error
      console.error("Error saving image to clipboard", e);

      // Firefox specific message (only show once)
      if (
        navigator.userAgent.toLowerCase().includes("firefox") &&
        !firefoxClipboardNotificationShown
      ) {
        firefoxClipboardNotificationShown = true;
        showNoticeNotification(
          "On Firefox you can enable the asyncClipboard.clipboardItem permission in about:config to enable copying straight to the clipboard",
          { durationMs: 10000 },
        );
      }

      // General fallback notification and action
      showNoticeNotification(
        "Could not copy screenshot to clipboard. Opening in new tab instead (make sure popups are allowed)",
        { durationMs: 5000 },
      );
      try {
        // Fallback: Open blob in a new tab
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl);
        // No need to revoke URL immediately as the new tab needs it.
        // Browser usually handles cleanup when tab is closed or navigated away.
      } catch (openError) {
        showErrorNotification("Failed to open screenshot in new tab");
        console.error("Error opening blob URL:", openError);
      }
    }
  });
}

/**
 * Generates screenshot canvas and returns the image data as a Blob.
 * Handles notifications for canvas/blob generation errors.
 * (This function is intended to be used by the 'download' command)
 */
async function getBlob(): Promise<Blob | null> {
  const canvas = await generateCanvas();
  if (!canvas) {
    // Notification already handled by generateScreenshotCanvas
    return null;
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        showErrorNotification("Failed to convert canvas to Blob for download");
        resolve(null);
      } else {
        resolve(blob); // Return the generated blob
      }
    }, "image/png"); // Explicitly request PNG format
  });
}

function getFilename(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `oxytype-result-${timestamp}.png`;
}

/**
 * Opens the system share sheet with the screenshot (save to photos, send to
 * an app). Phones can't copy images to the clipboard after an async render.
 * Falls back to a download where files can't be shared.
 */
export async function share(): Promise<void> {
  const data = await getBlob();
  if (!data) return;
  const filename = getFilename();
  const file = new File([data], filename, { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      // closing the share sheet is not an error
      if (e instanceof DOMException && e.name === "AbortError") return;
      console.error("Error sharing screenshot", e);
    }
  }

  downloadFile({ data, filename });
  showSuccessNotification("Screenshot download started");
}

export async function download(): Promise<void> {
  try {
    const data = await getBlob();

    if (!data) {
      showErrorNotification("Failed to generate screenshot data");
      return;
    }
    const filename = getFilename();

    downloadFile({ data, filename });

    showSuccessNotification("Screenshot download started");
  } catch (error) {
    console.error("Error downloading screenshot:", error);
    showErrorNotification("Failed to download screenshot");
  }
}
