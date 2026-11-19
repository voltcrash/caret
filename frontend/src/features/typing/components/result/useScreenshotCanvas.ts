import { createBinding } from "../../../../app/binding";
import { onCleanup, onMount } from "solid-js";

import { showErrorNotification } from "../../../../ts/states/notifications";

type Crop = {
  source: HTMLCanvasElement;
  width: number;
  height: number;
  x: number;
  y: number;
  cropWidth: number;
  cropHeight: number;
};
const createCanvas = createBinding<(crop: Crop) => HTMLCanvasElement | null>();

export function createCroppedScreenshot(crop: Crop): HTMLCanvasElement | null {
  return createCanvas.require("Result canvas is not mounted")(crop);
}

export function useScreenshotCanvas(): void {
  onMount(() => {
    const create = (crop: Crop): HTMLCanvasElement | null => {
      const canvas = document.createElement("canvas");
      canvas.width = crop.width;
      canvas.height = crop.height;
      const ctx = canvas.getContext("2d");
      if (ctx === null) {
        showErrorNotification("Failed to get canvas context for screenshot");
        return null;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(
        crop.source,
        crop.x,
        crop.y,
        crop.cropWidth,
        crop.cropHeight,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      return canvas;
    };
    onCleanup(createCanvas.bind(create));
  });
}
