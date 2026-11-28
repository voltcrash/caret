mod config;
mod drift;
mod editing;
mod types;

pub use config::Config;
use drift::DriftTracker;
pub(crate) use types::Retained;
use types::{Checkpoint, ContentState, DeferredInput, RunState};
pub use types::{
    Command, Event, FinishRequest, InsertionLayout, LiveMetrics, Preflight, SessionMetadata,
    SessionPhase, Snapshot, State, Update, WordChange,
};

use crate::{EVENT_LOG_VERSION, Text, recorder::Recorder};
use serde_json::{Value, json};
use std::collections::VecDeque;

pub struct Session {
    pub pace: crate::pace::Pace,
    pub weak_spot: crate::weak_spot::WeakSpot,
    config: Config,
    words: Vec<Text>,
    input: Vec<Text>,
    index: usize,
    run: RunState,
    ticks: u32,
    recorder: Recorder,
    live: crate::live::Live,
    korean: bool,
    indent_pending: bool,
    pressed: Vec<(String, f64)>,
    no_code_index: usize,
    completion_checkpoint: bool,
    composing: bool,
    clear_input_display: bool,
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
    content_state: ContentState,
    deferred_input: Option<DeferredInput>,
    defer_finish: bool,
    drift: DriftTracker,
}

impl Session {
    pub fn live_stats(&self, now: f64) -> Result<LiveMetrics, crate::error::EngineError> {
        if !now.is_finite() || now.abs() > 9_007_199_254_740_991.0 {
            return Err("Invalid timestamp".into());
        }
        let chars = self.live.chars(true);
        let duration_ms = now - self.run.start_time().unwrap_or(now);
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
            timer_start_ms: self.run.start_time(),
            time_limit_seconds: self.time_limit(),
            ms_since_last_input: self.live.spacing(),
        })
    }
    pub fn time_limit(&self) -> Option<f64> {
        if self.config.mode == "time" {
            Some(self.config.time)
        } else if self.config.mode == "custom" {
            self.custom_limit
                .as_ref()
                .filter(|limit| limit.mode == "time")
                .map(|limit| limit.value)
        } else {
            None
        }
    }
    pub fn word_burst(&self, index: usize, now: f64) -> Result<f64, crate::error::EngineError> {
        if !now.is_finite()
            || now.abs() > 9_007_199_254_740_991.0
            || index > crate::validation::MAX_WORDS
        {
            return Err("Invalid live word query".into());
        }
        let origin = self.run.start_time().unwrap_or_else(|| self.origin());
        Ok(self.live.burst(index, origin, now - origin))
    }
    pub fn restart_policy(
        &self,
        options: crate::restart::RestartOptions,
    ) -> crate::restart::RestartDecision {
        let state = crate::restart::RestartState {
            active: self.run.active(),
            failed: self.run.reason().is_some(),
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
        let all_generated = config.all_words_generated_initially();
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
            run: RunState::Ready,
            ticks: 0,
            recorder: Recorder::default(),
            live: crate::live::Live::default(),
            korean,
            indent_pending: false,
            pressed: vec![],
            no_code_index: 0,
            completion_checkpoint: true,
            composing: false,
            clear_input_display: false,
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
            content_state: ContentState::Available,
            deferred_input: None,
            defer_finish: false,
            drift: DriftTracker::default(),
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
    pub fn metadata(&self) -> SessionMetadata {
        SessionMetadata {
            all_words_generated: self.all_generated,
            has_tab: self.has_tab,
            has_newline: self.has_newline,
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
            finish: self.run.pending_finish().cloned(),
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
        if self.config.mode == "zen" {
            return Ok(());
        }
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
    pub fn phase(&self) -> SessionPhase {
        match (&self.run, &self.content_state) {
            (RunState::Ended { .. }, _) => SessionPhase::Ended,
            (RunState::FinishPending { .. }, _) => SessionPhase::FinishPending,
            (_, ContentState::Recovery) => SessionPhase::AwaitingRecovery,
            (_, ContentState::Waiting(_)) => SessionPhase::AwaitingContent,
            (RunState::Running { .. }, ContentState::Available) => SessionPhase::Running,
            (RunState::Ready, ContentState::Available) => SessionPhase::Ready,
        }
    }
    pub fn state(&self) -> State {
        debug_assert!(
            !self.run.ended()
                || (!matches!(self.content_state, ContentState::Waiting(_))
                    && self.deferred_input.is_none())
        );
        State {
            word_index: self.index,
            input_value: self.current(),
            active: self.run.active(),
            ended: self.run.ended(),
            awaiting_recovery: matches!(self.content_state, ContentState::Recovery).then_some(true),
            reason: self.run.reason().cloned(),
        }
    }
    fn current(&self) -> Text {
        self.input.get(self.index).cloned().unwrap_or_default()
    }
    fn target(&self) -> Text {
        self.words.get(self.index).cloned().unwrap_or_default()
    }
    fn nospace(&self) -> bool {
        self.config.nospace()
    }
    fn record(&mut self, kind: &str, now: f64, data: Value) {
        self.live.record(kind, now, &data, &self.words, self.korean);
        self.recorder.push(kind, now, data);
    }
    fn start(&mut self, now: f64, date: f64) {
        if !matches!(self.run, RunState::Ready)
            || matches!(self.content_state, ContentState::Recovery)
        {
            return;
        }
        self.run = RunState::Running { start: now };
        self.drift.reset_run();
        self.pace.start(now);
        self.record(
            "timer",
            now,
            json!({"event":"start", "timer":0, "date":date}),
        );
    }
    fn finish(&mut self, now: f64, date: f64, reason: Option<String>) {
        let RunState::Running { start } = self.run else {
            return;
        };
        if self.defer_finish {
            self.run = RunState::FinishPending {
                start,
                at: now,
                request: FinishRequest { reason },
            };
        } else {
            self.end(now, date, reason);
        }
    }
    fn end(&mut self, now: f64, date: f64, reason: Option<String>) {
        let (RunState::Running { start } | RunState::FinishPending { start, .. }) = self.run else {
            return;
        };
        self.run = RunState::Ended { start, reason };
        self.drift.reset_run();

        self.content_state = ContentState::Available;
        self.deferred_input = None;
        self.automatic.clear();
        self.indent_pending = false;
        if let Some(generator) = &mut self.generator {
            generator.reset_requests(self.generation);
        }
        self.record(
            "timer",
            now,
            json!({"event":"end", "timer":((now-start)/1000.0).floor(), "date":date}),
        );
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
                .run
                .start_time()
                .is_some_and(|start| (now - start) / 1000.0 - f64::from(self.ticks) > 1_000_000.0)
        {
            return Err("Timer catchup exceeds bounded work".into());
        }
        if matches!(self.content_state, ContentState::Recovery)
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
        let before = self.recorder.events().len();
        let previous_metadata = self.metadata();
        let previous_origin = self.origin();
        let invalidated = matches!(command, Command::Finalize { .. } | Command::Reset { .. });
        self.word_changes.clear();
        self.recorder.clear_reordered();
        self.visual_input_override = None;
        self.drift.clear_last();
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
                        input_display_value: self.clear_input_display.then(Text::default),
                        metadata: None,
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
                        awaiting_content: matches!(self.content_state, ContentState::Waiting(_)),
                        finish: self.run.pending_finish().cloned(),
                        slow_timer: self.drift.slow_timer(),
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
                self.content_state = ContentState::Recovery;
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
                } else if matches!(self.content_state, ContentState::Waiting(_))
                    && let ContentState::Waiting(checkpoint) =
                        std::mem::take(&mut self.content_state)
                {
                    let input_now = checkpoint.now;
                    let input_date = checkpoint.date;
                    self.complete_input(checkpoint, now, date);
                    self.drain_indentation(input_now, input_date);
                    if !self.run.ended()
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
                let RunState::FinishPending { request, at, .. } = &self.run else {
                    return Err("Invalid completion acknowledgement".into());
                };
                if now < *at {
                    return Err("Invalid completion acknowledgement".into());
                }
                self.end(now, date, request.reason.clone());
            }
            Command::End { now, date } | Command::Abandon { now, date } => {
                self.end(now, date, None)
            }
            Command::Advance { now, date } => self.advance(now, date),
            Command::Reset { .. } => {
                self.index = 0;
                self.bailed_out = false;
                self.content_state = ContentState::Available;
                self.deferred_input = None;

                self.drift.reset_run();
                self.run = RunState::Ready;
                self.ticks = 0;
                self.indent_pending = false;
                self.recorder.clear();
                self.live = crate::live::Live::default();
                self.input = vec![Text::default(); self.words.len().max(1)];
                self.pressed.clear();
                self.no_code_index = 0;
                self.pace.reset(None);
                self.composing = false;
                self.clear_input_display = false;
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
                    self.drift.set_monitoring(monitor);
                }
            }
            Command::FlushAutomatic { generation, .. } => {
                if generation == self.generation
                    && !self.run.ended()
                    && self.run.pending_finish().is_none()
                    && let Some((now, date)) = self.automatic.pop_front()
                {
                    self.completion_checkpoint = !self.composing;
                    self.insert(9, now, date, None, true, false);
                    self.completion_checkpoint = true;
                }
            }
        }
        let origin = self.origin();
        let events = self.recorder.since(before, origin);
        Ok(Update {
            state: self.state(),
            input_display_value: self.clear_input_display.then(Text::default),
            metadata: (self.metadata() != previous_metadata).then(|| self.metadata()),
            events,
            generation: self.generation,
            automatic_pending: !self.automatic.is_empty(),
            words: self.word_changes.clone(),
            log_invalidated: invalidated || previous_origin != origin || self.recorder.reordered(),
            visual_input_override: self.visual_input_override.clone(),
            content_request: self
                .generator
                .as_ref()
                .and_then(|generator| generator.pending_request())
                .cloned(),
            awaiting_content: matches!(self.content_state, ContentState::Waiting(_)),
            finish: self.run.pending_finish().cloned(),
            slow_timer: self.drift.slow_timer(),
            drift: self.drift.last_drift(),
        })
    }

    fn origin(&self) -> f64 {
        self.recorder.origin()
    }
    pub fn log(&self) -> Value {
        serde_json::to_value(self.log_payload()).expect("Serializable log")
    }
    pub fn log_payload(&self) -> impl serde::Serialize + '_ {
        #[derive(serde::Serialize)]
        #[serde(rename_all = "camelCase")]
        struct LogContext<'a> {
            target_words: &'a Vec<Text>,
            mode: &'a String,
            mode2: String,
            korean_status: bool,
            bailed_out: bool,
            is_funbox_with_nospace_property_active: bool,
            punctuation: bool,
            numbers: bool,
            funbox: &'a Vec<String>,
            difficulty: &'a String,
            language: String,
            stop_on_letter: bool,
            #[serde(skip_serializing_if = "Option::is_none")]
            custom_text_limit_mode: Option<String>,
            #[serde(skip_serializing_if = "Option::is_none")]
            custom_text_limit_value: Option<f64>,
        }
        #[derive(serde::Serialize)]
        struct LogPayload<'a> {
            version: u32,
            events: Vec<Event>,
            context: LogContext<'a>,
        }
        let mode2 = crate::results::mode2(&self.config, self.quote.as_ref());
        let language = if self.config.mode == "quote" {
            crate::quotes::remove_language_size(&self.config.language)
        } else {
            self.config.language.clone()
        };
        LogPayload {
            version: EVENT_LOG_VERSION,
            events: self.recorder.log_events(),
            context: LogContext {
                target_words: &self.words,
                mode: &self.config.mode,
                mode2,
                korean_status: self.korean,
                bailed_out: self.bailed_out,
                is_funbox_with_nospace_property_active: self.nospace(),
                punctuation: self.config.punctuation,
                numbers: self.config.numbers,
                funbox: &self.config.funbox,
                difficulty: &self.config.difficulty,
                language,
                stop_on_letter: self.config.stop_on_error == "letter",
                custom_text_limit_mode: self.custom_limit.as_ref().map(|l| l.mode.clone()),
                custom_text_limit_value: self.custom_limit.as_ref().map(|l| l.value),
            },
        }
    }
}
