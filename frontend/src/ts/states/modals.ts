import { createAppStore } from "../../app/state";
import { createAppOwned } from "../../app/application";
const modalHosts = createAppOwned(() => new Set<ModalId>());
export function registerModalHost(id: ModalId): () => void {
  modalHosts().add(id);
  return () => {
    modalHosts().delete(id);
    hideModalAndClearChain(id);
    completeModalHide(id);
  };
}

export type ModalId =
  | "Commandline"
  | "DevOptions"
  | "EventLogViewer"
  | "SimpleModal"
  | "ImportSettings"
  | "CustomText"
  | "SaveCustomText"
  | "SavedTexts"
  | "WordFilter"
  | "CustomGenerator"
  | "QuoteSearch"
  | "QuoteRate"
  | "QuoteReport"
  | "QuoteSubmit"
  | "QuoteApprove"
  | "TestDuration"
  | "ShareTestSettings"
  | "CustomWordAmount"
  | "MobileTestConfig"
  | "PbTables"
  | "MiniResultChartModal"
  | "Cookies"
  | "AddPresetModal"
  | "EditPresetModal"
  | "EditProfile"
  | "LastSignedOutResult"
  | "StreakHourOffset"
  | "GoogleSignup"
  | "UserReport"
  | "EditResultTags"
  | "PractiseWords";

export type ModalVisibility = {
  visible: boolean;
  chained: boolean;
};

type ModalState = {
  openModals: Partial<Record<ModalId, ModalVisibility>>;
  modalStack: ModalId[];
  pendingModal: ModalId | null;
  pendingIsChained: boolean;
  closingModal: ModalId | null;
};

const [modalState, setModalState] = createAppStore<ModalState>({
  openModals: {},
  modalStack: [],
  pendingModal: null,
  pendingIsChained: false,
  closingModal: null,
});

export function showModal(id: ModalId): void {
  if (modalState.closingModal !== null) {
    setModalState({ pendingModal: id, pendingIsChained: true });
    return;
  }
  const currentlyOpenModal = getCurrentlyOpenModal();

  if (currentlyOpenModal !== null && currentlyOpenModal !== id) {
    // A different modal is open, chain them
    setModalState((state) => ({
      modalStack: [...state.modalStack, currentlyOpenModal],
      pendingModal: id,
      pendingIsChained: true,
      closingModal: currentlyOpenModal,
    }));

    // Hide current modal with chained flag - the new modal will show after hide completes
    setModalState("openModals", currentlyOpenModal, {
      visible: false,
      chained: true,
    });
    if (!modalHosts().has(currentlyOpenModal)) completeModalHide(currentlyOpenModal);
  } else {
    // No modal open, show immediately
    setModalState("openModals", id, { visible: true, chained: false });
  }
}
export function hideModal(id: ModalId): void {
  if (modalState.closingModal !== null || !isModalOpen(id)) return;
  setModalState("closingModal", id);
  // Check if this modal was part of a chain (user dismissed, go back)
  const stackCopy = [...modalState.modalStack];
  const previousModal = stackCopy.pop();

  if (previousModal !== undefined) {
    // Queue the previous modal to show after hide animation completes
    setModalState({
      modalStack: stackCopy,
      pendingModal: previousModal,
      pendingIsChained: true,
    });

    // Mark current modal as hiding with chained flag
    setModalState("openModals", id, { visible: false, chained: true });
  } else {
    // No chain, just hide normally
    setModalState("openModals", id, { visible: false, chained: false });
  }
  if (!modalHosts().has(id)) completeModalHide(id);
}

/** Animation acknowledgement cannot be mistaken for another close request. */
export function completeModalHide(id: ModalId): void {
  if (modalState.closingModal !== id) return;
  const next = modalState.pendingModal;
  const chained = modalState.pendingIsChained;
  setModalState({ closingModal: null, pendingModal: null, pendingIsChained: false });
  if (next !== null) setModalState("openModals", next, { visible: true, chained });
}

export function hideModalAndClearChain(id: ModalId): void {
  // Clear the entire chain
  setModalState({
    modalStack: [],
    pendingModal: null,
    pendingIsChained: false,
  });

  hideModal(id);
}

export function getModalVisibility(id: ModalId): ModalVisibility | null {
  return modalState.openModals[id] ?? null;
}

export function isModalOpen(id: ModalId): boolean {
  return modalState.openModals[id]?.visible === true;
}

export function isModalChained(id: ModalId): boolean {
  return modalState.openModals[id]?.chained === true;
}

function getCurrentlyOpenModal(): ModalId | null {
  for (const [id, visibility] of Object.entries(modalState.openModals)) {
    if (visibility?.visible) {
      return id as ModalId;
    }
  }
  return null;
}
