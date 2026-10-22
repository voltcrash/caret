//! Platform-independent typing rules. Hosts provide content, observations and time.
pub mod generation;
pub mod pace;
pub mod random;
pub mod session;
pub mod stats;
pub mod text;
pub mod weak_spot;

pub use session::{Command, Config, Session};
pub use text::Text;

pub const BINDING_VERSION: u32 = 1;
pub const BEHAVIOR_VERSION: u32 = 1;
pub const EVENT_LOG_VERSION: u32 = 1;

/// Match JavaScript Math.round: halfway values round toward positive infinity.
pub fn js_round(value: f64) -> f64 {
    let floor = value.floor();
    if value - floor < 0.5 {
        floor
    } else {
        floor + 1.0
    }
}

/// Existing roundTo2 uses Number.EPSILON before rounding.
pub fn round2(value: f64) -> f64 {
    js_round((value + f64::EPSILON) * 100.0) / 100.0
}
