//! Server-side replay check: rederive a submitted result's metrics from its
//! event log. Clients compute the result with this same engine, so an honest
//! submission matches exactly; edited numbers must also come with a log that
//! produces them, keystroke timings included.
use crate::{
    error::EngineError,
    stats::{self, Log},
    validation,
};
use serde::Serialize;
use serde_json::{Value, json};
use ts_rs::TS;

#[derive(Clone, Debug, PartialEq, Serialize, TS)]
pub struct Mismatch {
    pub field: String,
    pub submitted: Value,
    pub replayed: Value,
}
#[derive(Clone, Debug, PartialEq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Verification {
    /// False when the client ran other scoring rules (a tab open across a
    /// deploy); nothing is compared then, since honest numbers may differ.
    pub same_behavior: bool,
    /// Empty when every replayed field matches the submission.
    pub mismatches: Vec<Mismatch>,
}

/// Summary fields a client copies straight from the engine.
const SUMMARY_FIELDS: [&str; 13] = [
    "wpm",
    "rawWpm",
    "charStats",
    "charTotal",
    "acc",
    "testDuration",
    "lastKeyToEnd",
    "startToFirstKey",
    "afkDuration",
    "consistency",
    "wpmConsistency",
    "keyConsistency",
    "keyOverlap",
];
/// Long tests submit these as "toolong" to save space.
const BULKY_FIELDS: [&str; 3] = ["chartData", "keySpacing", "keyDuration"];

// Same code on both sides, so honest values are bit-identical. The margin only
// absorbs JSON number round-trips, far below any meaningful edit.
fn close(a: f64, b: f64) -> bool {
    (a - b).abs() <= 1e-9 * a.abs().max(b.abs()).max(1.0)
}
fn same(submitted: &Value, replayed: &Value) -> bool {
    match (submitted, replayed) {
        (Value::Number(a), Value::Number(b)) => {
            a.as_f64().zip(b.as_f64()).is_some_and(|(a, b)| close(a, b))
        }
        (Value::Array(a), Value::Array(b)) => {
            a.len() == b.len() && a.iter().zip(b).all(|(a, b)| same(a, b))
        }
        (Value::Object(a), Value::Object(b)) => {
            a.len() == b.len()
                && b.iter()
                    .all(|(key, b)| a.get(key).is_some_and(|a| same(a, b)))
        }
        (a, b) => a == b,
    }
}

/// Compare a submitted completed result with the one its log replays to.
/// `behavior_version` is the client engine's `BEHAVIOR_VERSION`.
pub fn verify(
    log: &Log,
    submitted: &Value,
    behavior_version: u32,
) -> Result<Verification, EngineError> {
    validation::log(log)?;
    if behavior_version != crate::BEHAVIOR_VERSION {
        return Ok(Verification {
            same_behavior: false,
            mismatches: vec![],
        });
    }
    let summary = serde_json::to_value(stats::typed_summary(log)?).expect("Serializable summary");
    let mut expected: Vec<(&str, Value)> = SUMMARY_FIELDS
        .iter()
        .map(|&field| (field, summary[field].clone()))
        .collect();
    for field in BULKY_FIELDS {
        if submitted[field] != "toolong" {
            expected.push((field, summary[field].clone()));
        }
    }
    expected.push(("mode", json!(log.context.mode)));
    expected.push(("mode2", json!(log.context.mode2)));
    expected.push(("bailedOut", json!(log.context.bailed_out)));
    let mismatches = expected
        .into_iter()
        .filter(|(field, replayed)| !same(&submitted[*field], replayed))
        .map(|(field, replayed)| Mismatch {
            field: field.into(),
            submitted: submitted[field].clone(),
            replayed,
        })
        .collect();
    Ok(Verification {
        same_behavior: true,
        mismatches,
    })
}
