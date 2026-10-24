use crate::{
    EVENT_LOG_VERSION, Text, round2,
    text::{delete_word, is_space, normalize},
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::{BTreeMap, VecDeque};
use ts_rs::TS;

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(default, rename_all = "camelCase")]
pub struct Config {
    pub mode: String,
    pub words: u32,
    pub time: f64,
    pub language: String,
    pub difficulty: String,
    pub strict_space: bool,
    pub stop_on_error: String,
    pub delete_on_error: String,
    pub quick_end: bool,
    pub repeat_quotes: String,
    pub result_saving: bool,
    pub repeated_pace: bool,
    pub freedom_mode: bool,
    pub confidence_mode: String,
    pub blind_mode: bool,
    pub hide_extra_letters: bool,
    pub code_unindent_on_backspace: bool,
    pub funbox: Vec<String>,
    pub show_all_lines: bool,
    pub punctuation: bool,
    pub numbers: bool,
    pub lazy_mode: bool,
    pub british_english: bool,
    pub quote_length: Vec<i32>,
    pub custom_polyglot: Vec<String>,
    pub min_burst: String,
    pub min_burst_custom_speed: f64,
    pub min_wpm: String,
    pub min_wpm_custom_speed: f64,
    pub min_acc: String,
    pub min_acc_custom: f64,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            mode: "time".into(),
            words: 50,
            time: 30.0,
            language: "english".into(),
            difficulty: "normal".into(),
            strict_space: false,
            stop_on_error: "off".into(),
            delete_on_error: "off".into(),
            quick_end: false,
            repeat_quotes: "off".into(),
            result_saving: true,
            repeated_pace: true,
            freedom_mode: false,
            confidence_mode: "off".into(),
            blind_mode: false,
            hide_extra_letters: false,
            code_unindent_on_backspace: false,
            funbox: vec![],
            show_all_lines: false,
            punctuation: false,
            numbers: false,
            lazy_mode: false,
            british_english: false,
            quote_length: vec![1],
            custom_polyglot: vec![
                "english".into(),
                "spanish".into(),
                "french".into(),
                "german".into(),
            ],
            min_burst: "off".into(),
            min_burst_custom_speed: 100.0,
            min_wpm: "off".into(),
            min_wpm_custom_speed: 100.0,
            min_acc: "off".into(),
            min_acc_custom: 90.0,
        }
    }
}

impl Config {
    pub fn validate(&self) -> Result<(), String> {
        for (name, value, allowed) in [
            (
                "mode",
                self.mode.as_str(),
                &["time", "words", "quote", "custom", "zen"][..],
            ),
            (
                "difficulty",
                self.difficulty.as_str(),
                &["normal", "expert", "master"][..],
            ),
            (
                "stopOnError",
                self.stop_on_error.as_str(),
                &["off", "word", "letter"][..],
            ),
            (
                "deleteOnError",
                self.delete_on_error.as_str(),
                &["off", "word", "letter", "word_hard", "letter_hard"][..],
            ),
            (
                "confidenceMode",
                self.confidence_mode.as_str(),
                &["off", "on", "max"][..],
            ),
            (
                "minBurst",
                self.min_burst.as_str(),
                &["off", "fixed", "flex"][..],
            ),
            ("minWpm", self.min_wpm.as_str(), &["off", "custom"][..]),
            ("minAcc", self.min_acc.as_str(), &["off", "custom"][..]),
            (
                "repeatQuotes",
                self.repeat_quotes.as_str(),
                &["off", "typing"][..],
            ),
        ] {
            if !allowed.contains(&value) {
                return Err(format!("Invalid {name}"));
            }
        }
        if self.words > crate::validation::MAX_WORDS as u32
            || self
                .quote_length
                .iter()
                .any(|length| ![-3, -2, 0, 1, 2, 3].contains(length))
            || self
                .custom_polyglot
                .iter()
                .any(|language| language.len() > 128)
        {
            return Err("Invalid content selection bound".into());
        }
        if !self.time.is_finite() || self.time < 0.0 {
            return Err("Invalid time limit".into());
        }
        if [
            self.min_burst_custom_speed,
            self.min_wpm_custom_speed,
            self.min_acc_custom,
        ]
        .iter()
        .any(|value| !value.is_finite() || *value < 0.0)
            || self.min_acc_custom > 100.0
        {
            return Err("Invalid minimum threshold".into());
        }
        if self.language.is_empty()
            || self.language.len() > 128
            || !self
                .language
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || c == b'_')
        {
            return Err("Invalid language".into());
        }
        if self.funbox.len() > 64
            || self
                .funbox
                .iter()
                .any(|name| crate::funboxes::get(name).is_none())
        {
            return Err("Invalid funbox list".into());
        }
        if self.quote_length.len() > 64 || self.custom_polyglot.len() > 64 {
            return Err("Content selection exceeds bound".into());
        }
        Ok(())
    }
}

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
}
#[derive(Clone, Serialize, TS)]
pub struct FinishRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub reason: Option<String>,
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
    pub ms_since_last_input: Option<f64>,
}

#[derive(Clone)]
struct Recorded {
    kind: String,
    now: f64,
    data: Value,
}

struct Checkpoint {
    unit: u16,
    now: f64,
    date: f64,
    input: Text,
    target: Text,
    correct: bool,
    commit: bool,
    word_correct: bool,
    advance: bool,
    checkpoint: bool,
}
struct DeferredInput {
    units: VecDeque<u16>,
    now: f64,
    date: f64,
    shift: Option<bool>,
    automatic: bool,
    composition: bool,
    final_in_batch: bool,
}
pub(crate) struct Retained {
    pub weak_spot: crate::weak_spot::WeakSpot,
    pub last_pace_wpm: f64,
    pub previous: Vec<crate::generation::NextWord>,
    pub quote: Option<crate::quotes::Quote>,
    pub generation: u32,
}
pub struct Session {
    pub pace: crate::pace::Pace,
    pub weak_spot: crate::weak_spot::WeakSpot,
    config: Config,
    words: Vec<Text>,
    input: Vec<Text>,
    index: usize,
    active: bool,
    ended: bool,
    reason: Option<String>,
    start: Option<f64>,
    ticks: u32,
    events: Vec<Recorded>,
    last_event_order: Option<(f64, u8)>,
    log_reordered: bool,
    live: crate::live::Live,
    korean: bool,
    indent_pending: bool,
    pressed: Vec<(String, f64)>,
    no_code_index: usize,
    completion_checkpoint: bool,
    composing: bool,
    earliest_visible_word: usize,
    defer_automatic: bool,
    automatic: VecDeque<(f64, f64)>,
    generation: u32,
    generator: Option<crate::generation::Generator>,
    all_generated: bool,
    custom_limit: Option<crate::results::Limit>,
    quote: Option<crate::results::QuoteRef>,
    sections: Vec<usize>,
    word_changes: Vec<WordChange>,
    bailed_out: bool,
    visual_input_override: Option<Text>,
    has_tab: bool,
    has_newline: bool,
    pending_commit: Option<Checkpoint>,
    awaiting_recovery: bool,
    deferred_input: Option<DeferredInput>,
    defer_finish: bool,
    pending_finish: Option<FinishRequest>,
    pending_finish_at: f64,
    monitor_render_drift: bool,
    slow_timer: bool,
    slow_timer_count: u8,
    last_drift: Option<f64>,
}

impl Session {
    pub fn live_stats(&self, now: f64) -> Result<LiveMetrics, crate::error::EngineError> {
        if !now.is_finite() || now.abs() > 9_007_199_254_740_991.0 {
            return Err("Invalid timestamp".into());
        }
        let chars = self.live.chars(true);
        let duration_ms = now - self.start.unwrap_or(now);
        let seconds = duration_ms / 1000.0;
        Ok(LiveMetrics {
            wpm: crate::js_round(crate::stats::wpm(chars.correct_word, seconds)),
            raw: crate::js_round(crate::stats::wpm(
                chars.all_correct + chars.extra + chars.incorrect,
                seconds,
            )),
            acc: if self.live.has_input() {
                self.live.accuracy()
            } else {
                100.0
            },
            chars,
            seconds: seconds.floor(),
            duration_ms,
            timer_start_ms: self.start,
            ms_since_last_input: self.live.spacing(),
        })
    }
    pub fn restart_policy(
        &self,
        options: crate::restart::RestartOptions,
    ) -> crate::restart::RestartDecision {
        let state = crate::restart::RestartState {
            active: self.active,
            failed: self.reason.is_some(),
            repeated: self
                .generator
                .as_ref()
                .is_some_and(|generator| generator.is_repeating()),
            quote_language: self
                .generator
                .as_ref()
                .and_then(|generator| generator.current_quote.as_ref())
                .map(|quote| quote.language.as_str()),
        };
        crate::restart::decide(&self.config, state, self.custom_limit.as_ref(), options)
    }
    pub fn pace_command(
        &mut self,
        command: crate::pace::PaceCommand,
    ) -> Result<crate::pace::PaceUpdate, crate::error::EngineError> {
        self.pace
            .command(command, &self.words, self.config.blind_mode)
            .map_err(Into::into)
    }
    pub(crate) fn into_learning(self) -> Retained {
        let (learner, previous, quote) =
            self.generator
                .map_or((self.weak_spot, vec![], None), |generator| {
                    (
                        generator.weak_spot,
                        generator.previous,
                        generator.current_quote,
                    )
                });
        Retained {
            weak_spot: learner,
            last_pace_wpm: self.pace.last_wpm(),
            previous,
            quote,
            generation: self.generation,
        }
    }
    pub fn new(config: Config, words: Vec<Text>) -> Result<Self, crate::error::EngineError> {
        config.validate().map_err(|message| {
            crate::error::EngineError::new(crate::error::ErrorCode::InvalidConfig, message)
        })?;
        crate::validation::words(&words)?;
        let all_generated = config.mode != "time"
            && config.mode != "zen"
            && !(config.mode == "words" && config.words == 0);
        let sections = (1..=words.len()).collect();
        let has_tab = words.iter().any(|word| word.0.contains(&9));
        let has_newline = words.iter().any(|word| word.0.contains(&10));
        let korean = words.iter().any(crate::stats::contains_korean);
        Ok(Self {
            pace: crate::pace::Pace::default(),
            weak_spot: crate::weak_spot::WeakSpot::default(),
            config,
            input: vec![Text::default(); words.len().max(1)],
            words,
            index: 0,
            active: false,
            ended: false,
            reason: None,
            start: None,
            ticks: 0,
            events: vec![],
            last_event_order: None,
            log_reordered: false,
            live: crate::live::Live::default(),
            korean,
            indent_pending: false,
            pressed: vec![],
            no_code_index: 0,
            completion_checkpoint: true,
            composing: false,
            earliest_visible_word: 0,
            defer_automatic: false,
            automatic: VecDeque::new(),
            generation: 0,
            generator: None,
            all_generated,
            custom_limit: None,
            quote: None,
            sections,
            word_changes: vec![],
            bailed_out: false,
            visual_input_override: None,
            has_tab,
            has_newline,
            pending_commit: None,
            awaiting_recovery: false,
            deferred_input: None,
            defer_finish: false,
            pending_finish: None,
            pending_finish_at: 0.0,
            monitor_render_drift: false,
            slow_timer: false,
            slow_timer_count: 0,
            last_drift: None,
        })
    }

    pub fn from_generator(
        mut generator: crate::generation::Generator,
        repeating: bool,
    ) -> Result<Self, crate::error::EngineError> {
        let generated = generator.generate(repeating)?;
        Self::from_generated(generator, generated)
    }
    pub fn from_generated(
        generator: crate::generation::Generator,
        generated: crate::generation::Generated,
    ) -> Result<Self, crate::error::EngineError> {
        let mut session = Self::new(generator.config().clone(), generated.words)?;
        session.generation = generator.prepared_generation;
        session.sections = generated.section_indexes;
        session.has_tab = generated.has_tab;
        session.has_newline = generated.has_newline;
        session.custom_limit = generator.custom_limit();
        session.quote = generator
            .current_quote
            .as_ref()
            .map(|quote| crate::results::QuoteRef {
                id: quote.id,
                group: quote.group,
            });
        session.all_generated = generator.all_generated();
        session.generator = Some(generator);
        session.strip_final_separator();
        session.word_changes.clear();
        Ok(session)
    }
    pub fn preflight(&self, data: Text, layout: &InsertionLayout) -> Preflight {
        let target = self.target();
        let input = self.current();
        let observation = crate::input::Input {
            data,
            input_value: input.clone(),
            target_word: target.clone(),
            nospace: self.nospace(),
            correct_shift_used: None,
        };
        let normalized = crate::input::normalize_data(&self.config, &observation);
        let observation = crate::input::Input {
            data: normalized.clone(),
            ..observation
        };
        let blocked = self.ended
            || self.awaiting_recovery
            || self.pending_commit.is_some()
            || self.pending_finish.is_some()
            || crate::input::blocked(&self.config, &observation, self.has_newline);
        let display_length = target.len() - usize::from(target.0.last() == Some(&32));
        let measure_overflow = !blocked
            && !layout.slow_timer
            && !self.slow_timer
            && observation.data.len() == 1
            && !self.config.blind_mode
            && !self.config.hide_extra_letters
            && !self.config.delete_on_error.contains("hard")
            && input.len() >= display_length
            && !crate::input::should_advance(&self.config, &observation)
            && self.config.mode != "zen";
        Preflight {
            blocked: blocked || (measure_overflow && layout.wrapped),
            measure_overflow,
            normalized,
        }
    }
    pub fn snapshot(&self) -> Snapshot {
        Snapshot {
            state: self.state(),
            words: self.words.clone(),
            section_indexes: self.sections.clone(),
            all_words_generated: self.all_generated,
            has_tab: self.has_tab,
            has_newline: self.has_newline,
            current_quote: self.quote.clone(),
            finish: self.pending_finish.clone(),
        }
    }
    fn strip_final_separator(&mut self) {
        if self.all_generated
            && let Some(word) = self.words.last_mut()
            && word.len() > 1
            && matches!(word.0.last(), Some(32 | 10))
        {
            word.0.pop();
            let index = self.words.len() - 1;
            self.live.recount(index, self.words.get(index), self.korean);
            self.word_changes.push(WordChange {
                index,
                word: self.words[index].clone(),
                section_index: self.sections[index],
            });
        }
    }
    fn refill(&mut self) -> Result<(), crate::error::EngineError> {
        let bound = crate::funboxes::to_push(&self.config.funbox)
            .map_or(100, |count| count.saturating_sub(1));
        if self.all_generated || self.words.len().saturating_sub(self.index + 1) > bound {
            return Ok(());
        }
        let strip = |word: &Text| {
            let mut word = word.clone();
            if matches!(word.0.last(), Some(32 | 10)) {
                word.0.pop();
            }
            word
        };
        let previous = self.words.last().map(strip);
        let previous2 = self.words.get(self.words.len().wrapping_sub(2)).map(strip);
        let Some(generator) = &mut self.generator else {
            return Ok(());
        };
        let index = self.words.len();
        let next = generator.next(index, bound, previous.as_ref(), previous2.as_ref())?;
        self.has_tab |= next.word.0.contains(&9);
        self.has_newline |= next.word.0.contains(&10);
        if !self.korean && crate::stats::contains_korean(&next.word) {
            self.korean = true;
            self.live.recount_all(&self.words, true);
        }
        self.words.push(next.word.clone());
        self.sections.push(next.section_index);
        self.word_changes.push(WordChange {
            index,
            word: next.word,
            section_index: next.section_index,
        });
        self.all_generated = generator.all_generated();
        self.strip_final_separator();
        Ok(())
    }
    pub fn state(&self) -> State {
        State {
            word_index: self.index,
            input_value: self.current(),
            active: self.active,
            ended: self.ended,
            awaiting_recovery: self.awaiting_recovery.then_some(true),
            reason: self.reason.clone(),
        }
    }
    fn current(&self) -> Text {
        self.input.get(self.index).cloned().unwrap_or_default()
    }
    fn target(&self) -> Text {
        self.words.get(self.index).cloned().unwrap_or_default()
    }
    fn nospace(&self) -> bool {
        crate::funboxes::has_property(&self.config.funbox, "nospace")
    }
    fn record(&mut self, kind: &str, now: f64, data: Value) {
        let order = (round2(now), Self::rank(kind));
        if let Some(previous) = self.last_event_order {
            let comparison = order
                .0
                .total_cmp(&previous.0)
                .then(order.1.cmp(&previous.1));
            if comparison.is_lt() {
                self.log_reordered = true;
            } else {
                self.last_event_order = Some(order);
            }
        } else {
            self.last_event_order = Some(order);
        }
        self.live.record(kind, now, &data, &self.words, self.korean);
        self.events.push(Recorded {
            kind: kind.into(),
            now: round2(now),
            data,
        });
    }
    fn start(&mut self, now: f64, date: f64) {
        if self.active || self.ended {
            return;
        }
        self.active = true;
        self.slow_timer = false;
        self.slow_timer_count = 0;
        self.start = Some(now);
        self.pace.start(now);
        self.record(
            "timer",
            now,
            json!({"event":"start", "timer":0, "date":date}),
        );
    }
    fn finish(&mut self, now: f64, date: f64, reason: Option<String>) {
        if !self.active || self.ended || self.pending_finish.is_some() {
            return;
        }
        if self.defer_finish {
            self.pending_finish = Some(FinishRequest { reason });
            self.pending_finish_at = now;
        } else {
            self.end(now, date, reason);
        }
    }
    fn end(&mut self, now: f64, date: f64, reason: Option<String>) {
        if !self.active || self.ended {
            return;
        }
        self.active = false;
        self.ended = true;
        self.reason = reason;
        self.slow_timer = false;
        self.slow_timer_count = 0;
        self.pending_finish = None;
        self.pending_commit = None;
        self.deferred_input = None;
        if let Some(generator) = &mut self.generator {
            generator.reset_requests(self.generation);
        }
        self.record("timer", now, json!({"event":"end", "timer":((now-self.start.unwrap_or(now))/1000.0).floor(), "date":date}));
    }

    pub fn apply(&mut self, command: Command) -> Result<Update, crate::error::EngineError> {
        let now = match &command {
            Command::Insert { now, .. }
            | Command::Delete { now, .. }
            | Command::Start { now, .. }
            | Command::Advance { now, .. }
            | Command::Finish { now, .. }
            | Command::End { now, .. }
            | Command::Abandon { now, .. }
            | Command::Reset { now }
            | Command::Observe { now, .. }
            | Command::Finalize { now }
            | Command::View { now, .. }
            | Command::FlushAutomatic { now, .. }
            | Command::Configure { now, .. }
            | Command::CustomLimit { now, .. }
            | Command::Bailout { now, .. }
            | Command::FailContent { now, .. }
            | Command::SupplyContent { now, .. }
            | Command::AcknowledgeFinish { now, .. } => *now,
        };
        if !now.is_finite() || now.abs() > 9_007_199_254_740_991.0 {
            return Err("Invalid timestamp".into());
        }
        match &command {
            Command::Configure { config, .. } => config.validate().map_err(|message| {
                crate::error::EngineError::new(crate::error::ErrorCode::InvalidConfig, message)
            })?,
            Command::Observe {
                event_type,
                event_data,
                ..
            } => crate::validation::observation(event_type, event_data)?,
            Command::Insert { data, date, .. } => {
                if data.len() > 65536 {
                    return Err("Committed input exceeds bound".into());
                }
                if !date.is_finite() {
                    return Err("Invalid wall-clock date".into());
                }
            }
            Command::Start { date, .. }
            | Command::Advance { date, .. }
            | Command::Finish { date, .. }
            | Command::End { date, .. }
            | Command::Abandon { date, .. }
            | Command::Delete { date, .. }
            | Command::Bailout { date, .. }
            | Command::SupplyContent { date, .. }
            | Command::AcknowledgeFinish { date, .. }
                if !date.is_finite() =>
            {
                return Err("Invalid wall-clock date".into());
            }
            _ => {}
        }
        if matches!(command, Command::Advance { .. })
            && self
                .start
                .is_some_and(|start| (now - start) / 1000.0 - f64::from(self.ticks) > 1_000_000.0)
        {
            return Err("Timer catchup exceeds bounded work".into());
        }
        if self.awaiting_recovery
            && matches!(
                command,
                Command::Start { .. }
                    | Command::Observe { .. }
                    | Command::FlushAutomatic { .. }
                    | Command::Bailout { .. }
                    | Command::Finish { .. }
            )
        {
            return Err(crate::error::EngineError::new(
                crate::error::ErrorCode::SourceUnavailable,
                "Session awaits content recovery",
            ));
        }
        let before = self.events.len();
        let previous_origin = self.origin();
        let invalidated = matches!(command, Command::Finalize { .. } | Command::Reset { .. });
        self.word_changes.clear();
        self.log_reordered = false;
        self.visual_input_override = None;
        self.last_drift = None;
        match command {
            Command::Insert {
                data,
                now,
                date,
                correct_shift_used,
                automatic,
                is_composition_ending,
                layout,
            } => {
                if is_composition_ending == Some(true) {
                    self.composing = false;
                }
                let layout = layout.unwrap_or_default();
                if self.preflight(data.clone(), &layout).blocked {
                    return Ok(Update {
                        state: self.state(),
                        events: vec![],
                        generation: self.generation,
                        automatic_pending: !self.automatic.is_empty(),
                        words: vec![],
                        log_invalidated: false,
                        visual_input_override: None,
                        content_request: self
                            .generator
                            .as_ref()
                            .and_then(|generator| generator.pending_request())
                            .cloned(),
                        awaiting_content: self.pending_commit.is_some(),
                        finish: self.pending_finish.clone(),
                        slow_timer: self.slow_timer,
                        drift: None,
                    });
                }
                self.process_input(DeferredInput {
                    units: data.0.into(),
                    now,
                    date,
                    shift: correct_shift_used,
                    automatic: automatic == Some(true),
                    composition: is_composition_ending == Some(true),
                    final_in_batch: layout.final_in_batch != Some(false),
                });
            }
            Command::FailContent { request, .. } => {
                let error = self
                    .generator
                    .as_mut()
                    .ok_or("Session has no generated content")?
                    .fail_source(&request, true)?;
                self.awaiting_recovery = true;
                self.pending_commit = None;
                self.deferred_input = None;
                self.automatic.clear();
                return Err(error);
            }
            Command::SupplyContent {
                now,
                date,
                request,
                source,
            } => {
                self.generator
                    .as_mut()
                    .ok_or("Session has no generated content")?
                    .supply(&request, *source)?;
                if let Err(error) = self.refill() {
                    if self
                        .generator
                        .as_ref()
                        .and_then(|generator| generator.pending_request())
                        .is_none()
                    {
                        return Err(error);
                    }
                } else if let Some(checkpoint) = self.pending_commit.take() {
                    let input_now = checkpoint.now;
                    let input_date = checkpoint.date;
                    self.complete_input(checkpoint, now, date);
                    self.drain_indentation(input_now, input_date);
                    if !self.ended
                        && let Some(input) = self.deferred_input.take()
                    {
                        self.process_input(input);
                    }
                }
            }
            Command::Delete {
                kind,
                now,
                observed_input,
                sentinel_removed,
                ..
            } => {
                if !["deleteContentBackward", "deleteWordBackward"].contains(&kind.as_str()) {
                    return Err("Invalid deletion kind".into());
                }
                if observed_input.as_ref().is_some_and(|observed| {
                    !self.current().0.starts_with(&observed.0)
                        || (sentinel_removed && !observed.is_empty())
                }) {
                    return Err("Invalid deletion observation".into());
                }
                self.delete(&kind, now, observed_input, sentinel_removed);
            }
            Command::Configure { config, .. } => {
                if let Some(generator) = &mut self.generator {
                    generator.configure((*config).clone())?;
                    self.all_generated = generator.all_generated();
                }
                self.config = *config;
            }
            Command::CustomLimit { mode, value, .. } => {
                if !["word", "time", "section"].contains(&mode.as_str())
                    || !value.is_finite()
                    || value < 0.0
                {
                    return Err("Invalid custom limit".into());
                }
                self.all_generated = mode != "time"
                    && value > 0.0
                    && self
                        .generator
                        .as_ref()
                        .is_none_or(|generator| generator.all_generated());
                self.custom_limit = Some(crate::results::Limit { mode, value });
            }
            Command::Bailout { now, date } => {
                self.bailed_out = true;
                self.finish(now, date, None);
            }
            Command::Start { now, date } => self.start(now, date),
            Command::Finish { now, date, reason } => self.finish(now, date, reason),
            Command::AcknowledgeFinish { now, date } => {
                if self.pending_finish.is_none() || now < self.pending_finish_at {
                    return Err("Invalid completion acknowledgement".into());
                }
                let finish = self.pending_finish.take().unwrap();
                self.end(now, date, finish.reason);
            }
            Command::End { now, date } | Command::Abandon { now, date } => {
                self.end(now, date, None)
            }
            Command::Advance { now, date } => self.advance(now, date),
            Command::Reset { .. } => {
                self.index = 0;
                self.bailed_out = false;
                self.awaiting_recovery = false;
                self.pending_commit = None;
                self.deferred_input = None;
                self.pending_finish = None;
                self.slow_timer = false;
                self.slow_timer_count = 0;
                self.active = false;
                self.ended = false;
                self.reason = None;
                self.start = None;
                self.ticks = 0;
                self.indent_pending = false;
                self.events.clear();
                self.last_event_order = None;
                self.live = crate::live::Live::default();
                self.input = vec![Text::default(); self.words.len().max(1)];
                self.pressed.clear();
                self.no_code_index = 0;
                self.pace.reset(None);
                self.composing = false;
                self.earliest_visible_word = 0;
                self.automatic.clear();
                self.generation = self.generation.wrapping_add(1);
                if let Some(generator) = &mut self.generator {
                    generator.reset_requests(self.generation);
                }
            }
            Command::Observe {
                now,
                event_type,
                event_data,
            } => self.observe(&event_type, now, event_data)?,
            Command::Finalize { .. } => self.finalize(),
            Command::View {
                earliest_visible_word,
                defer_automatic,
                defer_finish,
                monitor_render_drift,
                ..
            } => {
                self.earliest_visible_word = earliest_visible_word.unwrap_or(0);
                if let Some(defer) = defer_automatic {
                    self.defer_automatic = defer;
                }
                if let Some(defer) = defer_finish {
                    self.defer_finish = defer;
                }
                if let Some(monitor) = monitor_render_drift {
                    self.monitor_render_drift = monitor;
                }
            }
            Command::FlushAutomatic { generation, .. } => {
                if generation == self.generation
                    && !self.ended
                    && self.pending_finish.is_none()
                    && let Some((now, date)) = self.automatic.pop_front()
                {
                    self.completion_checkpoint = !self.composing;
                    self.insert(9, now, date, None, true, false);
                    self.completion_checkpoint = true;
                }
            }
        }
        let origin = self.origin();
        let events = self
            .events
            .get(before..)
            .unwrap_or_default()
            .iter()
            .map(|event| Self::event(event, origin))
            .collect();
        Ok(Update {
            state: self.state(),
            events,
            generation: self.generation,
            automatic_pending: !self.automatic.is_empty(),
            words: self.word_changes.clone(),
            log_invalidated: invalidated || previous_origin != origin || self.log_reordered,
            visual_input_override: self.visual_input_override.clone(),
            content_request: self
                .generator
                .as_ref()
                .and_then(|generator| generator.pending_request())
                .cloned(),
            awaiting_content: self.pending_commit.is_some(),
            finish: self.pending_finish.clone(),
            slow_timer: self.slow_timer,
            drift: self.last_drift,
        })
    }

    fn process_input(&mut self, mut input: DeferredInput) {
        while !self.ended
            && self.pending_finish.is_none()
            && let Some(unit) = input.units.pop_front()
        {
            self.completion_checkpoint =
                input.units.is_empty() && input.final_in_batch && !self.composing;
            self.insert(
                unit,
                input.now,
                input.date,
                input.shift,
                input.automatic,
                input.composition,
            );
            if self.pending_commit.is_some() {
                if !input.units.is_empty() {
                    self.deferred_input = Some(input);
                }
                break;
            }
        }
        self.completion_checkpoint = true;
    }
    fn insert(
        &mut self,
        unit: u16,
        now: f64,
        date: f64,
        shift: Option<bool>,
        automatic: bool,
        composition: bool,
    ) {
        self.insert_one(unit, now, date, shift, automatic, composition);
        self.drain_indentation(now, date);
    }
    fn drain_indentation(&mut self, now: f64, date: f64) {
        if self.pending_commit.is_some() || self.ended || self.pending_finish.is_some() {
            return;
        }
        if self.defer_automatic && self.indent_pending {
            self.indent_pending = false;
            self.automatic.push_back((now, date));
            return;
        }
        while self.indent_pending
            && !self.ended
            && self.pending_commit.is_none()
            && self.pending_finish.is_none()
        {
            self.indent_pending = false;
            self.insert_one(9, now, date, None, true, false);
            if self.defer_automatic && self.indent_pending {
                self.indent_pending = false;
                self.automatic.push_back((now, date));
                break;
            }
        }
    }

    fn insert_one(
        &mut self,
        unit: u16,
        now: f64,
        date: f64,
        shift: Option<bool>,
        automatic: bool,
        composition: bool,
    ) {
        let input = self.current();
        let target = self.target();
        let nospace = self.nospace();
        let observation = crate::input::Input {
            data: Text(vec![unit]),
            input_value: input.clone(),
            target_word: target.clone(),
            nospace,
            correct_shift_used: shift,
        };
        if crate::input::blocked(&self.config, &observation, self.has_newline) {
            return;
        }
        let unit = normalize(
            unit,
            target.0.get(input.len()).copied(),
            &self.config.language,
        );
        let replacement = if unit == 0x2026 && target.0.get(input.len()) != Some(&unit) {
            Some("...")
        } else if unit == 0x0133
            && crate::text::base_language(&self.config.language) == "dutch"
            && target.0.get(input.len()) != Some(&unit)
        {
            Some("ij")
        } else {
            None
        };
        if let Some(replacement) = replacement {
            let checkpoint = self.completion_checkpoint;
            let replacement: Vec<_> = replacement.encode_utf16().collect();
            for (index, unit) in replacement.iter().enumerate() {
                self.completion_checkpoint = checkpoint && index + 1 == replacement.len();
                if !self.ended {
                    self.insert(*unit, now, date, shift, automatic, composition);
                }
            }
            self.completion_checkpoint = checkpoint;
            return;
        }
        let observation = crate::input::Input {
            data: Text(vec![unit]),
            ..observation
        };
        let commit = crate::input::commit(&observation).is_some();
        let decision = crate::input::evaluate(&self.config, &observation);
        let mut raw_next = input.clone();
        raw_next.0.push(unit);
        let word_correct = raw_next == target;
        let next = decision.input_value;
        self.visual_input_override = decision.visual_input_override;
        let correct = decision.correct;
        let stopped = decision.stopped;
        let advance = decision.advance;
        self.start(now, date);
        let mut data = json!({"inputType":"insertText", "data":Text(vec![unit]), "correct":correct, "wordIndex":self.index,
            "charIndex":input.len(), "inputValue":next});
        for (key, yes) in [
            ("inputStopped", stopped),
            ("commitsWord", advance),
            ("lastWord", self.index + 1 == self.words.len()),
            ("automatic", automatic),
            ("isCompositionEnding", composition),
        ] {
            if yes {
                data[key] = json!(true);
            }
        }
        self.input
            .resize(self.input.len().max(self.index + 1), Text::default());
        if advance {
            self.pace
                .correct(self.index, next == target, &target, self.config.blind_mode);
        }
        self.input[self.index] = next;
        let previous = self.live.last_input_at();
        self.record("input", now, data);
        let learner = self
            .generator
            .as_mut()
            .map_or(&mut self.weak_spot, |generator| &mut generator.weak_spot);
        learner.update(
            &Text(vec![unit]),
            correct,
            previous.map(|previous| round2(round2(now) - previous)),
        );
        if !correct && !stopped && self.config.delete_on_error != "off" {
            self.delete_error(now);
        }
        let checkpoint = Checkpoint {
            unit,
            now,
            date,
            input,
            target,
            correct,
            commit,
            word_correct,
            advance,
            checkpoint: self.completion_checkpoint,
        };
        if advance && let Err(_) = self.refill() {
            if self
                .generator
                .as_ref()
                .and_then(|generator| generator.pending_request())
                .is_some()
            {
                if self.index + 1 >= self.words.len() {
                    self.pending_commit = Some(checkpoint);
                    return;
                }
            } else {
                self.finish(now, date, Some("word generation error".into()));
                return;
            }
        }
        self.complete_input(checkpoint, now, date);
    }
    fn complete_input(&mut self, checkpoint: Checkpoint, finish_now: f64, finish_date: f64) {
        let Checkpoint {
            unit,
            now,
            date: _,
            input,
            target,
            correct,
            commit,
            word_correct,
            advance,
            checkpoint,
        } = checkpoint;
        let checkpoint = checkpoint && !self.composing;
        // The actual browser navigates before checking difficulty/minimum burst.
        let committed_index = self.index;
        let progressed =
            advance && (self.index + 1 < self.words.len() || self.config.mode == "zen");
        if progressed {
            self.index += 1;
        }
        if checkpoint
            && self.config.mode != "zen"
            && ((self.config.difficulty == "master" && !correct)
                || (self.config.difficulty == "expert"
                    && commit
                    && !(input.is_empty() && (is_space(unit) || unit == 10))
                    && !word_correct))
        {
            self.finish(finish_now, finish_date, Some("difficulty".into()));
            return;
        }
        if checkpoint && progressed && self.config.min_burst != "off" {
            let burst = self.live.burst(
                committed_index,
                self.origin(),
                now - self.start.unwrap_or(now),
            );
            let length = if self.config.mode == "zen" {
                input.len() + 1
            } else {
                target.len()
            };
            let flex = self.config.min_burst_custom_speed.min(
                (self.config.min_burst_custom_speed * 1.03_f64.powf(-2.0 * (length as f64 - 3.0)))
                    .floor(),
            );
            if burst
                < (if self.config.min_burst == "flex" {
                    flex
                } else {
                    self.config.min_burst_custom_speed
                })
            {
                self.finish(finish_now, finish_date, Some("min burst".into()));
                return;
            }
        }
        let finite = self.all_generated;
        let quick = self.config.quick_end
            && target.len() == input.len() + 1
            && self.config.stop_on_error == "off"
            && self.config.delete_on_error == "off";
        if checkpoint
            && committed_index + 1 >= self.words.len()
            && finite
            && (word_correct || quick || advance)
        {
            self.finish(finish_now, finish_date, None);
        }
        if !self.ended
            && correct
            && self.config.language.starts_with("code")
            && self.target().0.first() == Some(&9)
            && self.target().0.get(self.current().len()) == Some(&9)
        {
            self.indent_pending = true;
        }
    }

    fn log_delete(&mut self, kind: &str, now: f64, char_index: usize, next: Text, automatic: bool) {
        let mut data = json!({"inputType":kind,"wordIndex":self.index,"charIndex":char_index,"inputValue":next});
        if automatic {
            data["automatic"] = json!(true);
        }
        self.record("input", now, data);
        self.input
            .resize(self.input.len().max(self.index + 1), Text::default());
        self.input[self.index] = next;
    }

    fn previous_input(&self, kind: &str) -> Text {
        let mut input = self.input.get(self.index).cloned().unwrap_or_default();
        if kind == "deleteWordBackward" {
            input.0.clear();
        } else if self.nospace() || matches!(input.0.last(), Some(32 | 10)) {
            input.0.pop();
        }
        input
    }

    fn delete_error(&mut self, now: f64) {
        let input = self.current();
        let whole = self.config.delete_on_error.starts_with("word");
        let kind = if whole {
            "deleteWordBackward"
        } else {
            "deleteContentBackward"
        };
        if !input.is_empty() {
            let next = if whole {
                Text::default()
            } else {
                Text(input.0[..input.len() - 1].to_vec())
            };
            self.log_delete(kind, now, input.len(), next, true);
            if !whole && input.len() > 1 {
                self.log_delete(
                    kind,
                    now,
                    input.len() - 1,
                    Text(input.0[..input.len() - 2].to_vec()),
                    true,
                );
            }
        }
        if self.config.delete_on_error.contains("hard")
            && input.len() <= 1
            && self.index > self.earliest_visible_word
        {
            self.index -= 1;
            let previous = self.previous_input(kind);
            self.log_delete(kind, now, previous.len(), previous, true);
        }
    }

    fn delete(&mut self, kind: &str, now: f64, observed: Option<Text>, sentinel_removed: bool) {
        if !self.active
            || self.ended
            || self.awaiting_recovery
            || self.pending_commit.is_some()
            || self.pending_finish.is_some()
        {
            return;
        }
        let input = self.current();
        if input.is_empty() && self.index <= self.earliest_visible_word {
            return;
        }
        let prev = self
            .index
            .checked_sub(1)
            .and_then(|index| self.input.get(index))
            .cloned()
            .unwrap_or_default();
        let previous_correct = self.index > 0 && self.words.get(self.index - 1) == Some(&prev);
        if !crate::input::can_delete(
            &self.config,
            &input,
            self.index,
            previous_correct,
            self.index > self.earliest_visible_word,
        ) {
            return;
        }
        let after = observed.unwrap_or_else(|| {
            if kind == "deleteWordBackward" {
                delete_word(&input)
            } else {
                Text(input.0[..input.len().saturating_sub(1)].to_vec())
            }
        });
        let unindent = self.config.language.starts_with("code")
            && self.config.code_unindent_on_backspace
            && !input.is_empty()
            && input.0.iter().all(|c| *c == 9)
            && self.target().0.starts_with(&after.0);
        if unindent {
            self.log_delete(
                "deleteWordBackward",
                now,
                input.len(),
                Text::default(),
                false,
            );
        }
        let regression = input.is_empty() || unindent || sentinel_removed;
        let next = if regression {
            if self.index == 0 {
                Text::default()
            } else {
                self.index -= 1;
                self.previous_input(kind)
            }
        } else {
            after
        };
        let char_index = if regression { next.len() } else { input.len() };
        self.log_delete(
            if unindent {
                "deleteContentBackward"
            } else {
                kind
            },
            now,
            char_index,
            next,
            false,
        );
        if sentinel_removed && !unindent && !input.is_empty() {
            if let Some(event) = self.events.last_mut() {
                event.data["clearedNextWord"] = json!(true);
            }
            if let Some(input) = self.input.get_mut(self.index + 1) {
                input.0.clear();
            }
        }
    }

    fn advance(&mut self, now: f64, date: f64) {
        if !self.active || self.awaiting_recovery || self.pending_finish.is_some() {
            return;
        }
        let start = self.start.unwrap_or(now);
        let drift = round2(now - (start + f64::from(self.ticks + 1) * 1000.0));
        if drift < 0.0 {
            return;
        }
        self.last_drift = Some(drift);
        if self.monitor_render_drift
            && ((self.config.mode == "time" && self.config.time > 0.0 && self.config.time < 130.0)
                || (self.config.mode == "words"
                    && self.config.words > 0
                    && self.config.words < 250))
        {
            if drift > 125.0 {
                self.slow_timer = true;
            }
            if drift > 250.0 {
                self.slow_timer_count = self.slow_timer_count.saturating_add(1);
            }
            if drift > 500.0 || self.slow_timer_count > 5 {
                self.finish(now, date, Some("slow timer".into()));
                return;
            }
        }
        let due = ((now - start) / 1000.0).floor() as u32;
        while self.active && self.pending_finish.is_none() && self.ticks < due {
            self.ticks += 1;
            let mut data = json!({"event":"step","timer":self.ticks});
            if self.slow_timer {
                data["slowTimer"] = json!(true);
            }
            if self.ticks < due {
                data["catchup"] = json!(true);
            } else {
                data["drift"] = json!(drift);
            }
            self.record("timer", now, data);
            if self.ticks == due
                && (self.config.min_wpm == "custom" || self.config.min_acc == "custom")
            {
                let chars = self.live.chars(true);
                let wpm = crate::js_round(crate::stats::wpm(
                    chars.correct_word,
                    (now - start) / 1000.0,
                ));
                let accuracy = if self.live.has_input() {
                    self.live.accuracy()
                } else {
                    100.0
                };
                let reason = if self.config.min_wpm == "custom"
                    && wpm < self.config.min_wpm_custom_speed
                    && self.index > 3
                {
                    Some("min speed")
                } else if self.config.min_acc == "custom" && accuracy < self.config.min_acc_custom {
                    Some("min accuracy")
                } else {
                    None
                };
                if let Some(reason) = reason {
                    self.finish(now, date, Some(reason.into()));
                }
            }
            let limit = if self.config.mode == "time" {
                Some(self.config.time)
            } else if self.config.mode == "custom" {
                self.custom_limit
                    .as_ref()
                    .filter(|limit| limit.mode == "time")
                    .map(|limit| limit.value)
            } else {
                None
            };
            if limit.is_some_and(|limit| limit > 0.0 && f64::from(self.ticks) >= limit) {
                self.finish(now, date, None);
            }
        }
    }

    fn rank(kind: &str) -> u8 {
        match kind {
            "keyup" => 0,
            "keydown" => 1,
            "input" => 2,
            "composition" => 3,
            _ => 4,
        }
    }

    fn observe(
        &mut self,
        kind: &str,
        now: f64,
        mut data: Value,
    ) -> Result<(), crate::error::EngineError> {
        if !data.is_object() {
            return Err("Observation data must be an object".into());
        }
        if kind == "keydown" || kind == "keyup" {
            let code = data["code"].as_str().ok_or("Missing key code")?.to_owned();
            let tracked = (code.len() == 4
                && code.starts_with("Key")
                && code.as_bytes()[3].is_ascii_uppercase())
                || (code.len() == 6
                    && code.starts_with("Digit")
                    && code.as_bytes()[5].is_ascii_digit())
                || [
                    "NumpadMultiply",
                    "NumpadSubtract",
                    "NumpadAdd",
                    "NumpadDecimal",
                    "NumpadEqual",
                    "NumpadDivide",
                    "Numpad0",
                    "Numpad1",
                    "Numpad2",
                    "Numpad3",
                    "Numpad4",
                    "Numpad5",
                    "Numpad6",
                    "Numpad7",
                    "Numpad8",
                    "Numpad9",
                    "Backquote",
                    "Minus",
                    "Equal",
                    "BracketLeft",
                    "BracketRight",
                    "Backslash",
                    "Semicolon",
                    "Quote",
                    "IntlBackslash",
                    "Comma",
                    "Period",
                    "Slash",
                    "Space",
                    "Enter",
                    "Tab",
                    "NoCode",
                ]
                .contains(&code.as_str());
            let indexed_no_code = code.strip_prefix("NoCode").is_some_and(|suffix| {
                !suffix.is_empty() && suffix.bytes().all(|c| c.is_ascii_digit())
            });
            if !tracked && !(kind == "keyup" && indexed_no_code) {
                return Ok(());
            }
            let mut key = code.clone();
            if kind == "keydown" {
                if let Some(index) = self.pressed.iter().position(|(key, _)| key == &code) {
                    self.pressed.remove(index);
                    self.record("keyup", now, data.clone());
                }
                if code == "NoCode" {
                    key = format!("NoCode{}", self.no_code_index);
                    self.no_code_index += 1;
                }
                self.pressed.push((key.clone(), round2(now)));
            } else {
                if code == "NoCode" {
                    if self.no_code_index == 0 {
                        return Ok(());
                    }
                    key = format!("NoCode{}", self.no_code_index - 1);
                    if !self.pressed.iter().any(|(code, _)| code == &key) {
                        return Ok(());
                    }
                    self.no_code_index -= 1;
                }
                let Some(index) = self.pressed.iter().position(|(code, _)| code == &key) else {
                    return Ok(());
                };
                self.pressed.remove(index);
            }
            data["code"] = json!(key);
            self.record(kind, now, data);
        } else if kind == "composition" || kind == "timer" {
            if kind == "composition" {
                if data["event"] == "start" {
                    self.composing = true;
                } else if data["event"] == "end" {
                    self.composing = false;
                }
                data["wordIndex"] = json!(self.index);
            }
            self.record(kind, now, data);
        } else {
            return Err("Unsupported observation type".into());
        }
        Ok(())
    }

    fn finalize(&mut self) {
        let mut down = BTreeMap::new();
        for event in &self.events {
            if event.kind == "keydown" {
                down.insert(
                    event.data["code"].as_str().unwrap_or_default().to_owned(),
                    event.now,
                );
            }
        }
        let mut durations = vec![];
        for event in &self.events {
            if event.kind != "keyup" {
                continue;
            }
            if let Some(start) = down.remove(event.data["code"].as_str().unwrap_or_default()) {
                let duration = event.now - start;
                if duration > 0.0 {
                    durations.push(duration);
                }
            }
        }
        let average = if durations.is_empty() {
            80.0
        } else {
            round2(durations.iter().sum::<f64>() / durations.len() as f64)
        };
        for (key, now) in self.pressed.clone() {
            let _ = self.observe("keyup", now + average, json!({"code":key,"estimated":true}));
        }
        let start = self
            .events
            .iter()
            .find(|e| e.kind == "timer" && e.data["event"] == "start")
            .map(|e| e.now);
        let end = self
            .events
            .iter()
            .find(|e| e.kind == "timer" && e.data["event"] == "end")
            .map(|e| e.now);
        let last_pre = self
            .events
            .iter()
            .enumerate()
            .filter(|(_, e)| e.kind == "keydown" && start.is_some_and(|start| e.now < start))
            .map(|(i, _)| i)
            .next_back();
        let post_codes: Vec<_> = self
            .events
            .iter()
            .filter(|e| e.kind == "keydown" && end.is_some_and(|end| e.now > end))
            .map(|e| e.data["code"].clone())
            .collect();
        let mut index = 0;
        self.events.retain(|e| {
            let current = index;
            index += 1;
            if let Some(start) = start
                && e.now < start
                && (e.kind == "keyup" || (e.kind == "keydown" && Some(current) != last_pre))
            {
                return false;
            }
            if let Some(end) = end
                && e.now > end
                && (e.kind == "input"
                    || e.kind == "keydown"
                    || (e.kind == "keyup" && post_codes.contains(&e.data["code"])))
            {
                return false;
            }
            true
        });
        self.last_event_order = self
            .events
            .iter()
            .map(|event| (event.now, Self::rank(&event.kind)))
            .max_by(|a, b| a.0.total_cmp(&b.0).then(a.1.cmp(&b.1)));
        self.live = crate::live::Live::default();
        for event in &self.events {
            self.live.record(
                &event.kind,
                event.now,
                &event.data,
                &self.words,
                self.korean,
            );
        }
    }
    fn origin(&self) -> f64 {
        self.events
            .iter()
            .find(|e| e.kind == "timer" && e.data["event"] == "start")
            .map(|e| e.now)
            .unwrap_or_else(|| {
                self.events
                    .iter()
                    .map(|e| e.now)
                    .reduce(f64::min)
                    .unwrap_or(0.0)
            })
    }
    fn event(event: &Recorded, origin: f64) -> Event {
        Event {
            kind: event.kind.clone(),
            test_ms: round2(event.now - origin),
            data: event.data.clone(),
        }
    }
    pub fn log(&self) -> Value {
        let mut events = self.events.clone();
        events.sort_by(|a, b| {
            a.now
                .total_cmp(&b.now)
                .then(Self::rank(&a.kind).cmp(&Self::rank(&b.kind)))
        });
        let mode2 = match self.config.mode.as_str() {
            "words" => self.config.words.to_string(),
            "time" => self.config.time.to_string(),
            "quote" => self
                .quote
                .as_ref()
                .map_or_else(|| "-1".into(), |quote| quote.id.to_string()),
            other => other.into(),
        };
        let korean = self.korean;
        let mut log = json!({"version":EVENT_LOG_VERSION,"events":events.iter().map(|event|Self::event(event,self.origin())).collect::<Vec<_>>(),
            "context":{"targetWords":self.words,"mode":self.config.mode,"mode2":mode2,"koreanStatus":korean,"bailedOut":self.bailed_out,"isFunboxWithNospacePropertyActive":self.nospace()}});
        if let Some(limit) = &self.custom_limit {
            log["context"]["customTextLimitMode"] = json!(limit.mode);
            log["context"]["customTextLimitValue"] = json!(limit.value);
        }
        log
    }
}
