use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub enum ErrorCode {
    InvalidInput,
    InvalidConfig,
    InvalidContent,
    InvalidLog,
    Disposed,
    BindingMismatch,
    ContentRequired,
    EmptyContent,
    StaleRequest,
    NoQuotes,
    SelectedQuoteMissing,
    NoFavorites,
    NoQuoteLength,
    NoPolyglotLanguages,
    OnePolyglotLanguage,
    PolyglotDirection,
    SourceUnavailable,
}
#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize, TS)]
#[serde(tag = "op", rename_all = "camelCase")]
pub enum Recovery {
    SetMode {
        mode: String,
    },
    SetQuoteLengthAll,
    #[serde(rename_all = "camelCase")]
    DisableFunbox {
        name: String,
        no_restart: bool,
    },
    #[serde(rename_all = "camelCase")]
    SetLanguage {
        language: String,
        no_save: bool,
    },
    #[serde(rename_all = "camelCase")]
    Notice {
        message: String,
        duration_ms: u32,
    },
    ErrorNotice {
        message: String,
    },
    Restart,
}
#[derive(Clone, Debug, PartialEq, Eq, Deserialize, Serialize, TS)]
pub struct EngineError {
    pub code: ErrorCode,
    pub message: String,
    pub recovery: Vec<Recovery>,
}
impl EngineError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            recovery: vec![],
        }
    }
    pub fn recover(code: ErrorCode, message: impl Into<String>, recovery: Vec<Recovery>) -> Self {
        Self {
            code,
            message: message.into(),
            recovery,
        }
    }
}
impl From<String> for EngineError {
    fn from(message: String) -> Self {
        Self::new(ErrorCode::InvalidInput, message)
    }
}
impl From<&str> for EngineError {
    fn from(message: &str) -> Self {
        Self::from(message.to_owned())
    }
}
impl std::fmt::Display for EngineError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.message.fmt(formatter)
    }
}
impl std::error::Error for EngineError {}
impl std::ops::Deref for EngineError {
    type Target = str;
    fn deref(&self) -> &str {
        &self.message
    }
}
impl PartialEq<&str> for EngineError {
    fn eq(&self, other: &&str) -> bool {
        self.message == *other
    }
}
