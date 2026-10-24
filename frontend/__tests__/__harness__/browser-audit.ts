import { loadAudit } from "@oxytype/typing-engine/audit.client";

// Load the same module used by browser result inspection.
export const browserAudit = await loadAudit();
