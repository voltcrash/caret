pub mod content;
pub mod engine;
pub mod history;
pub mod input;
pub mod local;
pub mod options;
pub mod render;
pub mod replay;
pub mod setup;
pub mod storage;
pub mod terminal;
pub mod theme;

pub type Error = Box<dyn std::error::Error + Send + Sync>;
pub type Result<T> = std::result::Result<T, Error>;

pub fn version() -> String {
    format!(
        "{} (engine {}; log {}; build {})",
        env!("CARGO_PKG_VERSION"),
        typing_engine::BEHAVIOR_VERSION,
        typing_engine::EVENT_LOG_VERSION,
        env!("OXYTYPE_BUILD_REV")
    )
}
