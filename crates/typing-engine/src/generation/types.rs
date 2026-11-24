use crate::Text;
use crate::error::EngineError;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Debug, Default, Deserialize, TS)]
#[serde(default, rename_all = "camelCase")]
pub struct Language {
    pub name: String,
    pub bcp47: Option<String>,
    pub words: Vec<Text>,
    pub right_to_left: Option<bool>,
    pub joining_script: bool,
    pub original_punctuation: bool,
    pub no_lazy_mode: bool,
    pub additional_accents: Vec<(Text, Text)>,
}

pub type GenerationConfig = crate::Config;

#[derive(Clone, Debug, Deserialize, TS)]
pub struct CustomLimit {
    pub mode: String,
    pub value: f64,
}

#[derive(Clone, Debug, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CustomText {
    pub text: Vec<Text>,
    pub mode: String,
    pub limit: CustomLimit,
    pub pipe_delimiter: bool,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq, TS)]
#[serde(rename_all = "camelCase")]
pub struct NextWord {
    pub word: Text,
    pub word_raw: Text,
    pub section_index: usize,
}

#[derive(Clone, Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Generated {
    pub words: Vec<Text>,
    pub section_indexes: Vec<usize>,
    pub has_tab: bool,
    pub has_newline: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub all_right_to_left: Option<bool>,
    pub all_joining_script: bool,
}

#[derive(Default)]
pub struct Assets {
    pub quotes: crate::quotes::Quotes,
    pub quote_asset: Option<crate::quotes::QuoteAsset>,
    pub selected_quote_id: u32,
    pub favorite_quote_ids: Vec<u32>,
    pub polyglot: Vec<Language>,
    pub sections: Vec<crate::content::Source>,
}

pub(super) struct Batch {
    pub(super) repeating: bool,
    pub(super) limit: f64,
    pub(super) words: Vec<Text>,
    pub(super) indexes: Vec<usize>,
    pub(super) raw: Vec<Text>,
}

#[derive(Default)]
pub(super) enum BatchState {
    #[default]
    Idle,
    AwaitingContent(Batch),
    Failed(EngineError),
}
