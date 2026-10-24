//! Result auditing for hosts that judge results rather than run tests: the
//! server, its calibration tooling and the event log viewer. Kept apart from the
//! typing binding so its Wasm module ships only where it is used.
use crate::{
    challenges::{self, ChallengeResult},
    error::{EngineError, ErrorCode},
    funboxes,
    stats::Log,
    timing_review::{self, TimingReview},
    timing_stats::{self, CrossStats, DistStats},
    verification::{self, Verification},
};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use ts_rs::TS;

#[derive(Deserialize, TS)]
#[serde(tag = "op", rename_all = "camelCase")]
#[ts(rename = "AuditQuery")]
pub enum Query {
    #[serde(rename_all = "camelCase")]
    Verify {
        log: Box<Log>,
        #[ts(type = "unknown")]
        result: Value,
        behavior_version: u32,
    },
    #[serde(rename_all = "camelCase")]
    Review {
        key_spacing: Vec<f64>,
        key_duration: Vec<f64>,
    },
    Distribution {
        values: Vec<f64>,
    },
    #[serde(rename_all = "camelCase")]
    Bellness {
        values: Vec<f64>,
        use_logs: bool,
    },
    Cross {
        spacing: Vec<f64>,
        duration: Vec<f64>,
    },
    Probit {
        values: Vec<f64>,
    },
    Challenge {
        result: ChallengeResult,
        #[ts(type = "Record<string, unknown>")]
        config: Map<String, Value>,
        #[ts(type = "Record<string, unknown> | null")]
        requirements: Option<Map<String, Value>>,
    },
    Compatible {
        names: Vec<String>,
    },
}
#[derive(Serialize, TS)]
#[serde(tag = "op", rename_all = "camelCase")]
#[ts(rename = "AuditResponse")]
pub enum Response {
    Verify { result: Verification },
    Review { result: Option<TimingReview> },
    Distribution { result: Option<DistStats> },
    Bellness { result: Option<f64> },
    Cross { result: CrossStats },
    Probit { result: Vec<f64> },
    Challenge { result: Vec<String> },
    Compatible { result: bool },
}

fn finite(values: &[f64]) -> Result<(), EngineError> {
    if values.iter().all(|v| v.is_finite()) {
        Ok(())
    } else {
        Err(EngineError::new(
            ErrorCode::InvalidInput,
            "Audit values must be finite",
        ))
    }
}

pub fn audit(query: Query) -> Result<Response, EngineError> {
    Ok(match query {
        Query::Verify {
            log,
            result,
            behavior_version,
        } => Response::Verify {
            result: verification::verify(&log, &result, behavior_version)?,
        },
        Query::Review {
            key_spacing,
            key_duration,
        } => {
            finite(&key_spacing)?;
            finite(&key_duration)?;
            Response::Review {
                result: timing_review::review(&key_spacing, &key_duration),
            }
        }
        Query::Distribution { values } => {
            finite(&values)?;
            Response::Distribution {
                result: timing_stats::dist_stats(&values),
            }
        }
        Query::Bellness { values, use_logs } => {
            finite(&values)?;
            Response::Bellness {
                result: timing_stats::bellness(&values, use_logs),
            }
        }
        Query::Cross { spacing, duration } => {
            finite(&spacing)?;
            finite(&duration)?;
            Response::Cross {
                result: timing_stats::cross_stats(&spacing, &duration),
            }
        }
        Query::Probit { values } => Response::Probit {
            result: values.into_iter().map(timing_stats::probit).collect(),
        },
        Query::Challenge {
            result,
            config,
            requirements,
        } => Response::Challenge {
            result: challenges::verify(&result, &config, requirements.as_ref())
                .map_err(|message| EngineError::new(ErrorCode::InvalidInput, message))?,
        },
        Query::Compatible { names } => Response::Compatible {
            result: funboxes::compatible(&names),
        },
    })
}
