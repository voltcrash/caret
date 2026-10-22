use crate::{
    EVENT_LOG_VERSION, Text, round2,
    text::{delete_word, is_space, normalize},
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::BTreeMap;
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
    pub freedom_mode: bool,
    pub confidence_mode: String,
    pub blind_mode: bool,
    pub code_unindent_on_backspace: bool,
    pub funbox: Vec<String>,
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
            freedom_mode: false,
            confidence_mode: "off".into(),
            blind_mode: false,
            code_unindent_on_backspace: false,
            funbox: vec![],
            min_burst: "off".into(),
            min_burst_custom_speed: 100.0,
            min_wpm: "off".into(),
            min_wpm_custom_speed: 100.0,
            min_acc: "off".into(),
            min_acc_custom: 90.0,
        }
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
    },
    Delete {
        kind: String,
        now: f64,
        #[serde(default)]
        date: f64,
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
}

#[derive(Clone, Debug, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct State {
    pub word_index: usize,
    pub input_value: Text,
    pub active: bool,
    pub ended: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub reason: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Event {
    #[serde(rename = "type")]
    pub kind: String,
    pub test_ms: f64,
    pub data: Value,
}

#[derive(Serialize, TS)]
pub struct Update {
    pub state: State,
    pub events: Vec<Event>,
}

#[derive(Clone)]
struct Recorded {
    kind: String,
    now: f64,
    data: Value,
}

pub struct Session {
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
    indent_pending: bool,
    pressed: Vec<(String, f64)>,
    no_code_index: usize,
}

impl Session {
    pub fn new(config: Config, words: Vec<Text>) -> Result<Self, String> {
        if !["time", "words", "quote", "custom", "zen"].contains(&config.mode.as_str()) {
            return Err("Invalid mode".into());
        }
        if !config.time.is_finite() || config.time < 0.0 {
            return Err("Invalid time limit".into());
        }
        Ok(Self {
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
            indent_pending: false,
            pressed: vec![],
            no_code_index: 0,
        })
    }

    pub fn state(&self) -> State {
        State {
            word_index: self.index,
            input_value: self.current(),
            active: self.active,
            ended: self.ended,
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
        self.config.funbox.iter().any(|name| {
            ["nospace", "arrows", "morse", "underscore_spaces"].contains(&name.as_str())
        })
    }
    fn record(&mut self, kind: &str, now: f64, data: Value) {
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
        self.start = Some(now);
        self.record(
            "timer",
            now,
            json!({"event":"start", "timer":0, "date":date}),
        );
    }
    fn end(&mut self, now: f64, date: f64, reason: Option<String>) {
        if !self.active || self.ended {
            return;
        }
        self.active = false;
        self.ended = true;
        self.reason = reason;
        self.record("timer", now, json!({"event":"end", "timer":((now-self.start.unwrap_or(now))/1000.0).floor(), "date":date}));
    }

    pub fn apply(&mut self, command: Command) -> Result<Update, String> {
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
            | Command::Finalize { now } => *now,
        };
        if !now.is_finite() || now.abs() > 9_007_199_254_740_991.0 {
            return Err("Invalid timestamp".into());
        }
        let before = self.events.len();
        match command {
            Command::Insert {
                data,
                now,
                date,
                correct_shift_used,
                automatic,
                is_composition_ending,
            } => {
                for unit in data.0 {
                    if self.ended {
                        break;
                    }
                    self.insert(
                        unit,
                        now,
                        date,
                        correct_shift_used,
                        automatic == Some(true),
                        is_composition_ending == Some(true),
                    );
                }
            }
            Command::Delete { kind, now, .. } => {
                if !["deleteContentBackward", "deleteWordBackward"].contains(&kind.as_str()) {
                    return Err("Invalid deletion kind".into());
                }
                self.delete(&kind, now);
            }
            Command::Start { now, date } => self.start(now, date),
            Command::Finish { now, date, reason } => self.end(now, date, reason),
            Command::End { now, date } | Command::Abandon { now, date } => {
                self.end(now, date, None)
            }
            Command::Advance { now, date } => self.advance(now, date),
            Command::Reset { .. } => {
                self.index = 0;
                self.active = false;
                self.ended = false;
                self.reason = None;
                self.start = None;
                self.ticks = 0;
                self.indent_pending = false;
                self.events.clear();
                self.input = vec![Text::default(); self.words.len().max(1)];
                self.pressed.clear();
                self.no_code_index = 0;
            }
            Command::Observe {
                now,
                event_type,
                event_data,
            } => self.observe(&event_type, now, event_data)?,
            Command::Finalize { .. } => self.finalize(),
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
        })
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
        while self.indent_pending && !self.ended {
            self.indent_pending = false;
            self.insert_one(9, now, date, None, true, false);
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
        if unit == 10
            && self.config.mode != "zen"
            && !self.words.iter().any(|word| word.0.contains(&10))
        {
            return;
        }
        if is_space(unit) && nospace {
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
            && self.config.language.starts_with("dutch")
            && target.0.get(input.len()) != Some(&unit)
        {
            Some("ij")
        } else {
            None
        };
        if let Some(replacement) = replacement {
            for unit in replacement.encode_utf16() {
                if !self.ended {
                    self.insert(unit, now, date, shift, automatic, composition);
                }
            }
            return;
        }
        let commit = is_space(unit) || unit == 10 || (nospace && input.len() + 1 == target.len());
        if is_space(unit)
            && input.is_empty()
            && !self.config.strict_space
            && self.config.difficulty == "normal"
            && !self.config.delete_on_error.contains("hard")
        {
            return;
        }
        let mut next = input.clone();
        next.0.push(unit);
        let word_correct = next == target;
        let advance = commit
            && (self.config.mode == "zen"
                || (!(input.is_empty()
                    && !nospace
                    && (self.config.strict_space || self.config.difficulty != "normal"))
                    && (word_correct
                        || (self.config.stop_on_error == "off"
                            && self.config.delete_on_error == "off"))));
        let limit = if self.config.mode == "zen" {
            30
        } else {
            target.len() + 20
        };
        if input.len() >= limit && !advance {
            return;
        }
        self.start(now, date);
        let correct = self.config.mode == "zen"
            || (shift != Some(false) && target.0.get(input.len()) == Some(&unit));
        let stopped = (self.config.stop_on_error == "letter" && !correct) || shift == Some(false);
        if stopped {
            next = input.clone();
        }
        let advance = advance && !stopped;
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
        self.input[self.index] = next;
        self.record("input", now, data);
        if !correct && !stopped && self.config.delete_on_error != "off" {
            self.delete_error(now);
        }
        if self.config.mode != "zen"
            && ((self.config.difficulty == "master" && !correct)
                || (self.config.difficulty == "expert"
                    && commit
                    && !(input.is_empty() && (is_space(unit) || unit == 10))
                    && !word_correct))
        {
            self.end(now, date, Some("difficulty".into()));
            return;
        }
        if advance && self.config.min_burst != "off" {
            let log: crate::stats::Log =
                serde_json::from_value(self.log()).expect("Engine log is valid");
            let burst = crate::stats::word_burst(&log, self.index, now - self.start.unwrap_or(now));
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
                self.end(now, date, Some("min burst".into()));
                return;
            }
        }
        let finite = self.config.mode != "time"
            && self.config.mode != "zen"
            && !(self.config.mode == "words" && self.config.words == 0);
        let quick = self.config.quick_end
            && target.len() == input.len() + 1
            && self.config.stop_on_error == "off"
            && self.config.delete_on_error == "off";
        if self.index + 1 >= self.words.len() && finite && (word_correct || quick || advance) {
            self.end(now, date, None);
        } else if advance && (self.index + 1 < self.words.len() || self.config.mode == "zen") {
            self.index += 1;
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
        if self.config.delete_on_error.contains("hard") && input.len() <= 1 && self.index > 0 {
            self.index -= 1;
            let previous = self.previous_input(kind);
            self.log_delete(kind, now, previous.len(), previous, true);
        }
    }

    fn delete(&mut self, kind: &str, now: f64) {
        if !self.active || self.ended {
            return;
        }
        let input = self.current();
        if input.is_empty() && self.index == 0 {
            return;
        }
        let prev = self
            .index
            .checked_sub(1)
            .and_then(|index| self.input.get(index))
            .cloned()
            .unwrap_or_default();
        let previous_correct = self.index > 0 && self.words.get(self.index - 1) == Some(&prev);
        if !self.config.freedom_mode
            && (self.config.confidence_mode == "max"
                || (input.is_empty() && (self.config.confidence_mode == "on" || previous_correct)))
        {
            return;
        }
        let unindent = self.config.language.starts_with("code")
            && self.config.code_unindent_on_backspace
            && !input.is_empty()
            && input.0.iter().all(|c| *c == 9)
            && self.target().0.starts_with(&input.0);
        if unindent {
            self.log_delete(
                "deleteWordBackward",
                now,
                input.len(),
                Text::default(),
                false,
            );
        }
        let next = if input.is_empty() || unindent {
            self.index = self.index.saturating_sub(1);
            self.previous_input(kind)
        } else if kind == "deleteWordBackward" {
            delete_word(&input)
        } else {
            let mut next = input.clone();
            next.0.pop();
            next
        };
        let char_index = if input.is_empty() || unindent {
            next.len()
        } else {
            input.len()
        };
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
    }

    fn advance(&mut self, now: f64, date: f64) {
        if !self.active {
            return;
        }
        let start = self.start.unwrap_or(now);
        let drift = round2(now - (start + f64::from(self.ticks + 1) * 1000.0));
        if drift < 0.0 {
            return;
        }
        let due = ((now - start) / 1000.0).floor() as u32;
        while self.active && self.ticks < due {
            self.ticks += 1;
            let mut data = json!({"event":"step","timer":self.ticks});
            if self.ticks < due {
                data["catchup"] = json!(true);
            } else {
                data["drift"] = json!(drift);
            }
            self.record("timer", now, data);
            if self.ticks == due
                && (self.config.min_wpm == "custom" || self.config.min_acc == "custom")
            {
                let log: crate::stats::Log =
                    serde_json::from_value(self.log()).expect("Engine log is valid");
                let chars = crate::stats::chars(&log, true, None);
                let wpm = crate::js_round(crate::stats::wpm(
                    chars.correct_word,
                    (now - start) / 1000.0,
                ));
                let has_input = self
                    .events
                    .iter()
                    .any(|e| e.kind == "input" && e.data.get("correct").is_some());
                let accuracy = if has_input {
                    crate::stats::accuracy(&log, None)
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
                    self.end(now, date, Some(reason.into()));
                }
            }
            if self.config.mode == "time"
                && self.config.time > 0.0
                && f64::from(self.ticks) >= self.config.time
            {
                self.end(now, date, None);
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

    fn observe(&mut self, kind: &str, now: f64, mut data: Value) -> Result<(), String> {
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
            "quote" => "-1".into(),
            other => other.into(),
        };
        let korean=self.words.iter().flat_map(|word| &word.0).any(|c| matches!(*c,0xac00..=0xd7af | 0x1100..=0x11ff | 0x3130..=0x318f | 0xa960..=0xa97f | 0xd7b0..=0xd7ff));
        json!({"version":EVENT_LOG_VERSION,"events":events.iter().map(|event|Self::event(event,self.origin())).collect::<Vec<_>>(),
            "context":{"targetWords":self.words,"mode":self.config.mode,"mode2":mode2,"koreanStatus":korean,"bailedOut":false,"isFunboxWithNospacePropertyActive":self.nospace()}})
    }
}
