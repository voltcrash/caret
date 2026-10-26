import { EndpointMetadata } from "@caret/contracts/util/api";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import * as AdminUids from "../../src/dal/admin-uids";
import * as UserDal from "../../src/dal/user";
import { verifyPermissions } from "../../src/policies/permission";
import type { Actor } from "../../src/services/context";
import MonkeyError from "../../src/utils/error";
import * as Misc from "../../src/utils/misc";
import { enableMonkeyErrorExpects } from "../__testData__/monkey-error";

enableMonkeyErrorExpects();
const uid = "123456789";

type TestRequest = {
  tsRestRoute: { metadata: EndpointMetadata };
  ctx: { decodedToken?: Partial<Actor> };
};

/** The permission gate every transport runs before a service. */
async function invoke(
  req: TestRequest,
  next: (error?: unknown) => void,
): Promise<void> {
  try {
    await verifyPermissions(
      req.ctx.decodedToken as Actor,
      req.tsRestRoute.metadata,
    );
  } catch (error) {
    next(error);
    return;
  }
  next();
}

describe("permission policy", () => {
  const next = vi.fn();
  const getPartialUserMock = vi.spyOn(UserDal, "getPartialUser");
  const isAdminMock = vi.spyOn(AdminUids, "isAdmin");
  const isDevMock = vi.spyOn(Misc, "isDevEnvironment");

  beforeEach(() => {
    next.mockClear();
    getPartialUserMock.mockClear().mockResolvedValue({} as any);
    isDevMock.mockClear().mockReturnValue(false);
    isAdminMock.mockClear().mockResolvedValue(false);
  });
  afterEach(() => {
    //next function must only be called once
    expect(next).toHaveBeenCalledOnce();
  });

  it("should bypass without requiredPermission", async () => {
    //GIVEN
    const req = givenRequest({});
    //WHEN
    await invoke(req, next);

    //THEN
    expect(next).toHaveBeenCalledWith();
  });
  it("should bypass with empty requiredPermission", async () => {
    //GIVEN
    const req = givenRequest({ requirePermission: [] });
    //WHEN
    await invoke(req, next);

    //THE
    expect(next).toHaveBeenCalledWith();
  });

  describe("admin check", () => {
    const requireAdminPermission: EndpointMetadata = {
      requirePermission: "admin",
    };

    it("should fail without authentication", async () => {
      //GIVEN
      const req = givenRequest(requireAdminPermission);
      //WHEN
      await invoke(req, next);

      //THEN
      expect(next).toHaveBeenCalledWith(
        expect.toMatchMonkeyError(
          new MonkeyError(403, "You don't have permission to do this."),
        ),
      );
    });
    it("should pass without authentication if publicOnDev on dev", async () => {
      //GIVEN
      isDevMock.mockReturnValue(true);
      const req = givenRequest(
        {
          ...requireAdminPermission,
          authenticationOptions: { isPublicOnDev: true },
        },
        { uid },
      );
      //WHEN
      await invoke(req, next);

      //THEN
      expect(next).toHaveBeenCalledWith();
    });
    it("should fail without authentication if publicOnDev on prod ", async () => {
      //GIVEN
      const req = givenRequest(
        {
          ...requireAdminPermission,
          authenticationOptions: { isPublicOnDev: true },
        },
        { uid },
      );
      //WHEN
      await invoke(req, next);

      //THEN
      expect(next).toHaveBeenCalledWith(
        expect.toMatchMonkeyError(
          new MonkeyError(403, "You don't have permission to do this."),
        ),
      );
    });
    it("should fail without admin permissions", async () => {
      //GIVEN
      const req = givenRequest(requireAdminPermission, { uid });

      //WHEN
      await invoke(req, next);

      //THEN
      expect(next).toHaveBeenCalledWith(
        expect.toMatchMonkeyError(
          new MonkeyError(403, "You don't have permission to do this."),
        ),
      );
      expect(isAdminMock).toHaveBeenCalledWith(uid);
    });
  });
  describe("user checks", () => {
    it("fetches the user only once for multiple permission checks", async () => {
      getPartialUserMock.mockResolvedValue({
        canReport: true,
        quoteMod: true,
      } as any);
      await invoke(
        givenRequest({ requirePermission: ["canReport", "quoteMod"] }, { uid }),
        next,
      );
      expect(next).toHaveBeenCalledWith();
      expect(getPartialUserMock).toHaveBeenCalledOnce();
      expect(getPartialUserMock).toHaveBeenCalledWith(
        uid,
        "check user permissions",
        ["canReport", "quoteMod"],
      );
    });
    it("fails without authentication", async () => {
      await invoke(
        givenRequest({ requirePermission: ["canReport", "quoteMod"] }),
        next,
      );
      expect(next).toHaveBeenCalledWith(
        expect.toMatchMonkeyError(
          new MonkeyError(
            403,
            "Failed to check permissions, authentication required.",
          ),
        ),
      );
    });
  });
  describe("quoteMod check", () => {
    const requireQuoteMod: EndpointMetadata = {
      requirePermission: "quoteMod",
    };

    it("should pass for quoteAdmin", async () => {
      //GIVEN
      getPartialUserMock.mockResolvedValue({ quoteMod: true } as any);
      const req = givenRequest(requireQuoteMod, { uid });

      //WHEN
      await invoke(req, next);

      //THEN
      expect(next).toHaveBeenCalledWith();
      expect(getPartialUserMock).toHaveBeenCalledWith(
        uid,
        "check user permissions",
        ["quoteMod"],
      );
    });
    it("should pass for specific language", async () => {
      //GIVEN
      getPartialUserMock.mockResolvedValue({ quoteMod: "english" } as any);
      const req = givenRequest(requireQuoteMod, { uid });

      //WHEN
      await invoke(req, next);

      //THEN
      expect(next).toHaveBeenCalledWith();
      expect(getPartialUserMock).toHaveBeenCalledWith(
        uid,
        "check user permissions",
        ["quoteMod"],
      );
    });
    it("should fail for empty string", async () => {
      //GIVEN
      getPartialUserMock.mockResolvedValue({ quoteMod: "" } as any);
      const req = givenRequest(requireQuoteMod, { uid });

      //WHEN
      await invoke(req, next);

      //THEN
      expect(next).toHaveBeenCalledWith(
        expect.toMatchMonkeyError(
          new MonkeyError(403, "You don't have permission to do this."),
        ),
      );
    });
    it("should fail for missing quoteMod", async () => {
      //GIVEN
      getPartialUserMock.mockResolvedValue({} as any);
      const req = givenRequest(requireQuoteMod, { uid });

      //WHEN
      await invoke(req, next);

      //THEN
      expect(next).toHaveBeenCalledWith(
        expect.toMatchMonkeyError(
          new MonkeyError(403, "You don't have permission to do this."),
        ),
      );
    });
  });
  describe("canReport check", () => {
    const requireCanReport: EndpointMetadata = {
      requirePermission: "canReport",
    };

    it("should fail if user cannot report", async () => {
      //GIVEN
      getPartialUserMock.mockResolvedValue({ canReport: false } as any);
      const req = givenRequest(requireCanReport, { uid });

      //WHEN
      await invoke(req, next);

      //THEN
      expect(next).toHaveBeenCalledWith(
        expect.toMatchMonkeyError(
          new MonkeyError(403, "You don't have permission to do this."),
        ),
      );
      expect(getPartialUserMock).toHaveBeenCalledWith(
        uid,
        "check user permissions",
        ["canReport"],
      );
    });
    it("should pass if user can report", async () => {
      //GIVEN
      getPartialUserMock.mockResolvedValue({ canReport: true } as any);
      const req = givenRequest(requireCanReport, { uid });

      //WHEN
      await invoke(req, next);

      //THEN
      expect(next).toHaveBeenCalledWith();
    });
    it("should pass if canReport is not set", async () => {
      //GIVEN
      getPartialUserMock.mockResolvedValue({} as any);
      const req = givenRequest(requireCanReport, { uid });

      //WHEN
      await invoke(req, next);

      //THEN
      expect(next).toHaveBeenCalledWith();
    });
  });
});

function givenRequest(
  metadata: EndpointMetadata,
  decodedToken?: Partial<Actor>,
): TestRequest {
  return {
    tsRestRoute: { metadata },
    ctx: { decodedToken },
  };
}
