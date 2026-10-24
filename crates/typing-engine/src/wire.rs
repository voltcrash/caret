//! Generated typed view of v1 events. Internal recorder retains extra host metadata losslessly.
use crate::Text;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct InsertData {
    pub word_index: usize,
    pub char_index: usize,
    pub input_value: Text,
    pub data: Text,
    pub correct: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub automatic: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub is_composition_ending: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub input_stopped: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub commits_word: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub last_word: Option<bool>,
}
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct DeleteData {
    pub word_index: usize,
    pub char_index: usize,
    pub input_value: Text,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub automatic: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub cleared_next_word: Option<bool>,
}
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(tag = "inputType")]
pub enum InputData {
    #[serde(rename = "insertText")]
    InsertText {
        #[serde(flatten)]
        data: InsertData,
    },
    #[serde(rename = "insertCompositionText")]
    InsertCompositionText {
        #[serde(flatten)]
        data: InsertData,
    },
    #[serde(rename = "deleteContentBackward")]
    DeleteContentBackward {
        #[serde(flatten)]
        data: DeleteData,
    },
    #[serde(rename = "deleteWordBackward")]
    DeleteWordBackward {
        #[serde(flatten)]
        data: DeleteData,
    },
}
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
pub struct KeyData {
    pub code: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub ctrl: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub shift: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub alt: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub meta: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub estimated: Option<bool>,
}
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(tag = "event", rename_all = "camelCase")]
pub enum TimerData {
    Start {
        timer: f64,
        date: f64,
    },
    End {
        timer: f64,
        date: f64,
    },
    #[serde(rename_all = "camelCase")]
    Step {
        timer: f64,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        drift: Option<f64>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        slow_timer: Option<bool>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        catchup: Option<bool>,
    },
}
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(
    tag = "event",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum CompositionData {
    Start { word_index: usize },
    Update { word_index: usize, data: Text },
    End { word_index: usize, data: Text },
}
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(
    tag = "type",
    rename_all = "lowercase",
    rename_all_fields = "camelCase"
)]
pub enum TypedEvent {
    Input { test_ms: f64, data: InputData },
    Keydown { test_ms: f64, data: KeyData },
    Keyup { test_ms: f64, data: KeyData },
    Timer { test_ms: f64, data: TimerData },
    Composition { test_ms: f64, data: CompositionData },
}
