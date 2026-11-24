import { describe, expect, it } from "vite-plus/test";

import { mountApplication } from "../../src/app/application";
import {
  contributedModals,
  lazyModal,
  registerModals,
} from "../../src/app/modal-registry";
import {
  createTestApplication,
  releaseTestApplication,
} from "../__harness__/test-application";

describe("modal registry", () => {
  it("exposes registered modals per slot until released", () => {
    const appModal = lazyModal("CustomText", async () => () => null);
    const devModal = lazyModal("DevOptions", async () => () => null);

    const releaseApp = registerModals("app", [appModal]);
    const releaseDev = registerModals("dev", [devModal]);

    expect(contributedModals("app")).toEqual([appModal]);
    expect(contributedModals("dev")).toEqual([devModal]);

    releaseApp();
    releaseApp();

    expect(contributedModals("app")).toEqual([]);
    expect(contributedModals("dev")).toEqual([devModal]);

    releaseDev();

    expect(contributedModals("dev")).toEqual([]);
  });

  it("keeps registration order within a slot", () => {
    const first = lazyModal("QuoteRate", async () => () => null);
    const second = lazyModal("QuoteReport", async () => () => null);

    const releaseFirst = registerModals("app", [first]);
    const releaseSecond = registerModals("app", [second]);

    expect(contributedModals("app")).toEqual([first, second]);

    releaseFirst();
    releaseSecond();
  });

  it("isolates registered modals across application remounts", () => {
    releaseTestApplication();
    const first = createTestApplication();
    const releaseFirstApp = mountApplication(first.application);
    const modal = lazyModal("PractiseWords", async () => () => null);
    // Deliberately never released: contributions live in an app signal, so
    // disposing the application must drop them before the next mount.
    registerModals("app", [modal]);
    expect(contributedModals("app")).toEqual([modal]);

    first.dispose();
    releaseFirstApp();

    const next = createTestApplication();
    const releaseNextApp = mountApplication(next.application);
    expect(contributedModals("app")).toEqual([]);

    next.dispose();
    releaseNextApp();
  });
});
