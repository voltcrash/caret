import {
  initSync,
  binding_version,
  audit as rawAudit,
} from "../generated/audit.js";
import type { AuditQuery } from "../generated/types/AuditQuery";
import type { AuditResponse } from "../generated/types/AuditResponse";
import type { ChallengeResult } from "../generated/types/ChallengeResult";
import type { CrossStats } from "../generated/types/CrossStats";
import type { DistStats } from "../generated/types/DistStats";
import type { Log } from "../generated/types/Log";
import type { Mismatch } from "../generated/types/Mismatch";
import type { Quantum } from "../generated/types/Quantum";
import type { ReviewSignal } from "../generated/types/ReviewSignal";
import type { Significant } from "../generated/types/Significant";
import type { TimingFeatures } from "../generated/types/TimingFeatures";
import type { TimingReview } from "../generated/types/TimingReview";
import type { Verification } from "../generated/types/Verification";
import { EngineFailure, invoke } from "./failure";
export type {
  AuditQuery,
  AuditResponse,
  ChallengeResult,
  CrossStats,
  DistStats,
  Mismatch,
  ReviewSignal,
  Significant,
  TimingFeatures,
  TimingReview,
  Verification,
};

/** The grid key timings sit on, when there is one. */
export type QuantumFit = Quantum | null;

const BINDING_VERSION = 1;

type Answer<O extends AuditQuery["op"]> = Extract<
  AuditResponse,
  { op: O }
>["result"];

/** Synchronous result auditing over one instantiated audit module. */
export type Audit = {
  verify: (log: Log, result: unknown) => Verification;
  review: (keySpacing: number[], keyDuration: number[]) => TimingReview | null;
  distribution: (values: number[]) => DistStats | null;
  bellness: (values: number[], useLogs: boolean) => number | null;
  cross: (spacing: number[], duration: number[]) => CrossStats;
  probit: (values: number[]) => number[];
  challenge: (
    result: ChallengeResult,
    config: Record<string, unknown>,
    requirements: Record<string, unknown> | null,
  ) => string[];
  compatible: (names: string[]) => boolean;
};

/**
 * Instantiate the compiled audit module. Hosts compile it their own way:
 * Workers import it precompiled, Node reads bytes, browsers fetch it.
 */
export function createAudit(module: WebAssembly.Module): Audit {
  initSync({ module });
  if (binding_version() !== BINDING_VERSION) {
    throw new EngineFailure({
      code: "bindingMismatch",
      message: "Typing audit binding version mismatch",
      recovery: [],
    });
  }
  const query = <Q extends AuditQuery>(input: Q): Answer<Q["op"]> =>
    invoke(
      () =>
        (JSON.parse(rawAudit(JSON.stringify(input))) as { result: unknown })
          .result as Answer<Q["op"]>,
    );
  return {
    verify: (log, result) => query({ op: "verify", log, result }),
    review: (keySpacing, keyDuration) =>
      query({ op: "review", keySpacing, keyDuration }),
    distribution: (values) => query({ op: "distribution", values }),
    bellness: (values, useLogs) => query({ op: "bellness", values, useLogs }),
    cross: (spacing, duration) => query({ op: "cross", spacing, duration }),
    probit: (values) => query({ op: "probit", values }),
    challenge: (result, config, requirements) =>
      query({ op: "challenge", result, config, requirements }),
    compatible: (names) => query({ op: "compatible", names }),
  };
}
