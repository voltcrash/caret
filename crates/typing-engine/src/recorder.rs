//! Session event recording: ordered capture and event log materialization.
use serde_json::Value;

#[derive(Clone)]
pub(crate) struct Recorded {
    pub(crate) kind: String,
    pub(crate) now: f64,
    pub(crate) data: Value,
}

/// Sort rank among events sharing a timestamp: releases before presses before input.
pub(crate) fn rank(kind: &str) -> u8 {
    match kind {
        "keyup" => 0,
        "keydown" => 1,
        "input" => 2,
        "composition" => 3,
        _ => 4,
    }
}
