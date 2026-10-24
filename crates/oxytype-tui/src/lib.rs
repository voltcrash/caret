pub mod content;
pub mod engine;
pub mod options;
pub mod setup;
pub mod terminal;

pub type Error = Box<dyn std::error::Error + Send + Sync>;
pub type Result<T> = std::result::Result<T, Error>;

pub fn version() -> String {
    format!(
        "{} (engine {}; log {})",
        env!("CARGO_PKG_VERSION"),
        typing_engine::BEHAVIOR_VERSION,
        typing_engine::EVENT_LOG_VERSION
    )
}
