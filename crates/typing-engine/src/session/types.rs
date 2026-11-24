use super::Config;
use crate::Text;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::VecDeque;
use ts_rs::TS;

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(tag = "op", rename_all = "camelCase")]
pub enum Command {
    #[serde(rename_all = "camelCase")]
    Insert {
        data: Text,
        now: f64,
        #[serde(default)]
        date: f64,
        #[serde(default)]
        correct_shift_used: Option<bool>,
        #[serde(default)]
        automatic: Option<bool>,
        #[serde(default)]
        is_composition_ending: Option<bool>,
        #[serde(default)]
        #[ts(optional)]
        layout: Option<InsertionLayout>,
    },
    #[serde(rename_all = "camelCase")]
    Delete {
        kind: String,
        now: f64,
        #[serde(default)]
        date: f64,
        #[serde(default)]
        observed_input: Option<Text>,
        #[serde(default)]
        sentinel_removed: bool,
    },
    Start {
        now: f64,
        #[serde(default)]
        date: f64,
    },
    Advance {
        now: f64,
        #[serde(default)]
        date: f64,
    },
    Finish {
        now: f64,
        #[serde(default)]
        date: f64,
        #[serde(default)]
        reason: Option<String>,
    },
    End {
        now: f64,
        #[serde(default)]
        date: f64,
    },
    Abandon {
        now: f64,
        #[serde(default)]
        date: f64,
    },
    Reset {
        #[serde(default)]
        now: f64,
    },
    #[serde(rename_all = "camelCase")]
    Observe {
        now: f64,
        event_type: String,
        event_data: Value,
    },
    Finalize {
        now: f64,
    },
    #[serde(rename_all = "camelCase")]
    View {
        now: f64,
        #[serde(default)]
        earliest_visible_word: Option<usize>,
        #[serde(default)]
        defer_automatic: Option<bool>,
        #[serde(default)]
        #[ts(optional)]
        defer_finish: Option<bool>,
        #[serde(default)]
        #[ts(optional)]
        monitor_render_drift: Option<bool>,
    },
    AcknowledgeFinish {
        now: f64,
        #[serde(default)]
        date: f64,
    },
    #[serde(rename_all = "camelCase")]
    SupplyContent {
        now: f64,
        #[serde(default)]
        date: f64,
        request: crate::content::Request,
        source: Box<crate::content::Source>,
    },
    #[serde(rename_all = "camelCase")]
    FailContent {
        now: f64,
        request: crate::content::Request,
    },
    Configure {
        now: f64,
        config: Box<Config>,
    },
    #[serde(rename_all = "camelCase")]
    CustomLimit {
        now: f64,
        mode: String,
        value: f64,
    },
    Bailout {
        now: f64,
        #[serde(default)]
        date: f64,
    },
    FlushAutomatic {
        now: f64,
        generation: u32,
    },
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, TS)]
#[serde(default, rename_all = "camelCase")]
pub struct InsertionLayout {
    pub slow_timer: bool,
    pub wrapped: bool,
    pub final_in_batch: Option<bool>,
}

#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Preflight {
    pub blocked: bool,
    pub measure_overflow: bool,
    pub normalized: Text,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub expanded: Option<Text>,
}

#[derive(Clone, Serialize, TS)]
pub struct FinishRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub reason: Option<String>,
}

/// Lifecycle authority; input continuation is orthogonal to terminal completion.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SessionPhase {
    Ready,
    Running,
    AwaitingContent,
    AwaitingRecovery,
    FinishPending,
    Ended,
}

#[derive(Clone, Debug, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct State {
    pub word_index: usize,
    pub input_value: Text,
    pub active: bool,
    pub ended: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub awaiting_recovery: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub reason: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, TS)]
#[ts(as = "crate::wire::TypedEvent")]
pub struct Event {
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(rename = "testMs")]
    pub test_ms: f64,
    pub data: Value,
}

#[derive(Serialize, TS)]
pub struct Update {
    pub state: State,
    #[serde(rename = "inputDisplayValue", skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub input_display_value: Option<Text>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub metadata: Option<SessionMetadata>,
    pub events: Vec<Event>,
    pub generation: u32,
    #[serde(rename = "automaticPending")]
    pub automatic_pending: bool,
    pub words: Vec<WordChange>,
    #[serde(rename = "logInvalidated")]
    pub log_invalidated: bool,
    #[serde(
        rename = "visualInputOverride",
        skip_serializing_if = "Option::is_none"
    )]
    #[ts(optional)]
    pub visual_input_override: Option<Text>,
    #[serde(rename = "contentRequest", skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub content_request: Option<crate::content::Request>,
    #[serde(rename = "awaitingContent")]
    pub awaiting_content: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub finish: Option<FinishRequest>,
    #[serde(rename = "slowTimer")]
    pub slow_timer: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub drift: Option<f64>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct SessionMetadata {
    pub all_words_generated: bool,
    pub has_tab: bool,
    pub has_newline: bool,
}

#[derive(Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct WordChange {
    pub index: usize,
    pub word: Text,
    pub section_index: usize,
}

#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub state: State,
    pub words: Vec<Text>,
    pub section_indexes: Vec<usize>,
    pub all_words_generated: bool,
    pub has_tab: bool,
    pub has_newline: bool,
    pub current_quote: Option<crate::results::QuoteRef>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub finish: Option<FinishRequest>,
}

#[derive(Clone, Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct LiveMetrics {
    pub chars: crate::stats::Chars,
    pub wpm: f64,
    pub raw: f64,
    pub acc: f64,
    pub seconds: f64,
    pub duration_ms: f64,
    pub timer_start_ms: Option<f64>,
    pub time_limit_seconds: Option<f64>,
    pub ms_since_last_input: Option<f64>,
}

pub(super) struct Checkpoint {
    pub(super) unit: u16,
    pub(super) now: f64,
    pub(super) date: f64,
    pub(super) input: Text,
    pub(super) target: Text,
    pub(super) correct: bool,
    pub(super) commit: bool,
    pub(super) word_correct: bool,
    pub(super) advance: bool,
    pub(super) checkpoint: bool,
}

pub(super) struct DeferredInput {
    pub(super) units: VecDeque<u16>,
    pub(super) now: f64,
    pub(super) date: f64,
    pub(super) shift: Option<bool>,
    pub(super) automatic: bool,
    pub(super) composition: bool,
    pub(super) final_in_batch: bool,
}

pub(crate) struct Retained {
    pub weak_spot: crate::weak_spot::WeakSpot,
    pub last_pace_wpm: f64,
    pub previous: Vec<crate::generation::NextWord>,
    pub quote: Option<crate::quotes::Quote>,
    pub generation: u32,
}

#[derive(Default)]
pub(super) enum ContentState {
    #[default]
    Available,
    Waiting(Checkpoint),
    Recovery,
}

pub(super) enum RunState {
    Ready,
    Running {
        start: f64,
    },
    FinishPending {
        start: f64,
        at: f64,
        request: FinishRequest,
    },
    Ended {
        start: f64,
        reason: Option<String>,
    },
}

impl RunState {
    pub(super) fn start_time(&self) -> Option<f64> {
        match self {
            Self::Ready => None,
            Self::Running { start }
            | Self::FinishPending { start, .. }
            | Self::Ended { start, .. } => Some(*start),
        }
    }

    pub(super) fn active(&self) -> bool {
        matches!(self, Self::Running { .. } | Self::FinishPending { .. })
    }

    pub(super) fn ended(&self) -> bool {
        matches!(self, Self::Ended { .. })
    }

    pub(super) fn reason(&self) -> Option<&String> {
        match self {
            Self::Ended { reason, .. } => reason.as_ref(),
            _ => None,
        }
    }

    pub(super) fn pending_finish(&self) -> Option<&FinishRequest> {
        match self {
            Self::FinishPending { request, .. } => Some(request),
            _ => None,
        }
    }
}
