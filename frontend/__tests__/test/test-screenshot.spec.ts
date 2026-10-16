import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

type CaptureOptions = {
  filter: (node: Node) => boolean;
  onCloneEachNode: (node: Node) => void;
};
const mocks = vi.hoisted(() => ({
  options: undefined as CaptureOptions | undefined,
  canvas: undefined as HTMLCanvasElement | undefined,
  wrapper: undefined as HTMLDivElement | undefined,
  crop: vi.fn(),
  download: vi.fn(),
}));
vi.mock("modern-screenshot", () => ({
  domToCanvas: async (_node: Node, options: CaptureOptions) => {
    mocks.options = options;
    return mocks.canvas;
  },
}));
vi.mock(
  "../../src/features/typing/components/result/useScreenshotCanvas",
  () => ({ createCroppedScreenshot: mocks.crop }),
);
vi.mock("../../src/ts/components/common/Download", () => ({
  download: mocks.download,
}));
vi.mock("../../src/ts/states/result", () => ({
  getResultWrapperElement: () => mocks.wrapper,
  resultState: { replay: { visible: false } },
  setScreenshotWatermark: vi.fn(),
}));
vi.mock("../../src/ts/states/core", () => ({ setIsScreenshotting: vi.fn() }));
vi.mock("../../src/ts/states/loader-bar", () => ({
  showLoaderBar: vi.fn(),
  hideLoaderBar: vi.fn(),
}));
vi.mock("../../src/ts/states/theme", () => ({
  getTheme: () => ({ bg: "#000000" }),
}));
vi.mock("../../src/ts/states/notifications", () => ({
  showNoticeNotification: vi.fn(),
  showErrorNotification: vi.fn(),
  showSuccessNotification: vi.fn(),
}));
vi.mock("../../src/features/typing/runtime/funbox/list", () => ({
  getActiveFunboxesWithFunction: () => [],
}));
vi.mock("../../src/features/typing/runtime/replay", () => ({
  pauseReplay: vi.fn(),
}));
vi.mock("../../src/ts/db", () => ({ getSnapshot: () => undefined }));

import { download } from "../../src/features/typing/runtime/test-screenshot";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.options = undefined;
  mocks.canvas = document.createElement("canvas");
  mocks.canvas.toBlob = (callback) => {
    callback(new Blob(["png"], { type: "image/png" }));
  };
  mocks.crop.mockReturnValue(mocks.canvas);
  mocks.wrapper = document.createElement("div");
  Object.assign(mocks.wrapper.style, {
    marginTop: "0px",
    marginBottom: "0px",
    marginLeft: "0px",
    marginRight: "0px",
  });
  document.body.append(mocks.wrapper);
  document.documentElement.style.fontSize = "16px";
  vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(800);
  vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(
    600,
  );
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
});
afterEach(() => {
  mocks.wrapper?.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("screenshot capture", () => {
  it("excludes hidden elements and keeps text and SVG nodes", async () => {
    await download();
    expect(mocks.download).toHaveBeenCalledOnce();
    const options = mocks.options;
    if (!options) throw new Error("Missing capture options");
    const hidden = document.createElement("div");
    document.body.append(hidden);
    hidden.className = "hidden";
    expect(options.filter(hidden)).toBe(false);
    hidden.className = "";
    hidden.style.display = "none";
    expect(options.filter(hidden)).toBe(false);
    hidden.style.display = "block";
    expect(options.filter(hidden)).toBe(true);
    hidden.remove();
    expect(options.filter(document.createTextNode("text"))).toBe(true);
    expect(
      options.filter(
        document.createElementNS("http://www.w3.org/2000/svg", "svg"),
      ),
    ).toBe(true);
  });

  it.each([600, 1000])(
    "positions cloned backgrounds at viewport width %i",
    async (width) => {
      vi.spyOn(window, "innerWidth", "get").mockReturnValue(width);
      await download();
      const background = document.createElement("div");
      background.className = "customBackground";
      const image = document.createElement("img");
      background.append(image);
      mocks.options?.onCloneEachNode(background);
      expect(background.style.zIndex).toBe("0");
      expect(background.style.width).toBe("800px");
      expect(background.style.height).toBe("600px");
      expect(image.style.height).toBe("100%");
      expect(image.style.transform).toBe(
        width <= 720 ? "translateY(20vh)" : "",
      );
      const other = document.createElement("div");
      mocks.options?.onCloneEachNode(other);
      expect(other.style.zIndex).toBe("");
    },
  );
});
