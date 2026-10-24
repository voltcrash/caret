import { cleanup, render } from "@solidjs/testing-library";
import { afterEach, expect, it, vi } from "vite-plus/test";

import { Download, download } from "../../../src/ts/components/common/Download";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("downloads from a connected anchor with the requested name, then revokes its URL", () => {
  const createObjectURL = vi.fn(() => "blob:download");
  const revokeObjectURL = vi.fn();
  vi.spyOn(URL, "createObjectURL").mockImplementation(createObjectURL);
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(revokeObjectURL);
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.isConnected).toBe(true);
      expect(this.href).toBe("blob:download");
      expect(this.download).toBe("saved.txt");
      expect(revokeObjectURL).not.toHaveBeenCalled();
    });
  const { unmount } = render(() => <Download />);
  const data = new Blob(["saved text"]);
  download({ filename: "saved.txt", data });
  expect(createObjectURL).toHaveBeenCalledWith(data);
  expect(click).toHaveBeenCalledOnce();
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:download");
  unmount();
  expect(() => download({ filename: "saved.txt", data })).toThrow(
    "Download is not mounted",
  );
});
