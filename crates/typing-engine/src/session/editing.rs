use super::{Checkpoint, ContentState, DeferredInput, InsertionLayout, Preflight, Session};
use crate::{
    Text, round2,
    text::{delete_word, is_space, normalize},
};
use serde_json::{Value, json};

impl Session {
    pub fn preflight(&self, data: Text, layout: &InsertionLayout) -> Preflight {
        let target = self.target();
        let input = self.current();
        let observation = crate::input::Input {
            data,
            input_value: if self.clear_input_display {
                Text::default()
            } else {
                input.clone()
            },
            target_word: target.clone(),
            nospace: self.nospace(),
            correct_shift_used: None,
        };
        let normalized = crate::input::normalize_data(&self.config, &observation);
        let observation = crate::input::Input {
            data: normalized.clone(),
            ..observation
        };
        let blocked = self.run.ended()
            || !matches!(self.content_state, ContentState::Available)
            || self.run.pending_finish().is_some()
            || observation.data.len() > 65536
            || crate::input::blocked(&self.config, &observation, self.has_newline);
        let display_length = target.len() - usize::from(target.0.last() == Some(&32));
        let measure_overflow = !blocked
            && !layout.slow_timer
            && !self.drift.slow_timer()
            && observation.data.len() == 1
            && !self.config.blind_mode
            && !self.config.hide_extra_letters
            && !self.config.delete_on_error.contains("hard")
            && input.len() >= display_length
            && !crate::input::should_advance(&self.config, &observation)
            && self.config.mode != "zen";
        let expanded = if normalized.len() == 1 {
            self.config
                .expansion(normalized.0[0], target.0.get(input.len()).copied())
                .map(Text::from)
        } else {
            None
        };
        Preflight {
            blocked: blocked || (measure_overflow && layout.wrapped),
            measure_overflow,
            normalized,
            expanded,
        }
    }

    pub fn composition_completes(&self, data: &Text) -> Result<bool, crate::error::EngineError> {
        if data.len() > 65536 {
            return Err("Composition exceeds input bound".into());
        }
        if !self.run.active()
            || matches!(self.content_state, ContentState::Recovery)
            || self.run.pending_finish().is_some()
            || matches!(self.content_state, ContentState::Waiting(_))
            || !self.all_generated
            || self.index + 1 < self.words.len()
        {
            return Ok(false);
        }
        let mut combined = self.current().0;
        combined.extend_from_slice(&data.0);
        Ok(self.target().0 == combined)
    }

    pub(super) fn process_input(&mut self, mut input: DeferredInput) {
        while !self.run.ended()
            && self.run.pending_finish().is_none()
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
            if matches!(self.content_state, ContentState::Waiting(_)) {
                if !input.units.is_empty() {
                    self.deferred_input = Some(input);
                }
                break;
            }
        }
        self.completion_checkpoint = true;
    }

    pub(super) fn insert(
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

    pub(super) fn drain_indentation(&mut self, now: f64, date: f64) {
        if matches!(self.content_state, ContentState::Waiting(_))
            || self.run.ended()
            || self.run.pending_finish().is_some()
        {
            return;
        }
        if self.defer_automatic && self.indent_pending {
            self.indent_pending = false;
            self.automatic.push_back((now, date));
            return;
        }
        while self.indent_pending
            && !self.run.ended()
            && !matches!(self.content_state, ContentState::Waiting(_))
            && self.run.pending_finish().is_none()
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
        if crate::input::blocked(
            &self.config,
            &crate::input::Input {
                input_value: if self.clear_input_display {
                    Text::default()
                } else {
                    input.clone()
                },
                ..observation.clone()
            },
            self.has_newline,
        ) {
            return;
        }
        let unit = normalize(
            unit,
            target.0.get(input.len()).copied(),
            &self.config.language,
        );
        let replacement = self
            .config
            .expansion(unit, target.0.get(input.len()).copied());
        if let Some(replacement) = replacement {
            let checkpoint = self.completion_checkpoint;
            let replacement: Vec<_> = replacement.encode_utf16().collect();
            for (index, unit) in replacement.iter().enumerate() {
                self.completion_checkpoint = checkpoint && index + 1 == replacement.len();
                if !self.run.ended() {
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
        let next = if self.clear_input_display {
            if decision.stopped {
                Text::default()
            } else {
                Text(vec![unit])
            }
        } else {
            decision.input_value
        };
        self.clear_input_display = false;
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
                    self.content_state = ContentState::Waiting(checkpoint);
                    return;
                }
            } else {
                self.finish(now, date, Some("word generation error".into()));
                return;
            }
        }
        self.complete_input(checkpoint, now, date);
    }

    pub(super) fn complete_input(
        &mut self,
        checkpoint: Checkpoint,
        finish_now: f64,
        finish_date: f64,
    ) {
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
        if advance {
            self.clear_input_display = true;
        }
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
                now - self.run.start_time().unwrap_or(now),
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
        if !self.run.ended()
            && correct
            && self.config.is_code_language()
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

    /// Pure beforeinput guard; deletion repeats this check before mutation.
    pub fn can_delete(&self) -> bool {
        if !self.run.active()
            || !matches!(self.content_state, ContentState::Available)
            || self.run.pending_finish().is_some()
        {
            return false;
        }
        let input = if self.clear_input_display {
            Text::default()
        } else {
            self.current()
        };
        let empty = Text::default();
        let previous = self
            .index
            .checked_sub(1)
            .and_then(|index| self.input.get(index))
            .unwrap_or(&empty);
        let previous_correct = self.index > 0 && self.words.get(self.index - 1) == Some(previous);
        crate::input::can_delete(
            &self.config,
            &input,
            self.index,
            previous_correct,
            self.index > self.earliest_visible_word,
        )
    }

    pub(super) fn delete(
        &mut self,
        kind: &str,
        now: f64,
        observed: Option<Text>,
        sentinel_removed: bool,
    ) {
        if !self.can_delete() {
            return;
        }
        self.clear_input_display = false;
        let input = self.current();
        let after = observed.unwrap_or_else(|| {
            if kind == "deleteWordBackward" {
                delete_word(&input)
            } else {
                Text(input.0[..input.len().saturating_sub(1)].to_vec())
            }
        });
        let unindent = self.config.is_code_language()
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
            if let Some(data) = self.recorder.last_data_mut() {
                data["clearedNextWord"] = json!(true);
            }
            if let Some(input) = self.input.get_mut(self.index + 1) {
                input.0.clear();
            }
        }
    }

    pub(super) fn advance(&mut self, now: f64, date: f64) {
        if !self.run.active()
            || matches!(self.content_state, ContentState::Recovery)
            || self.run.pending_finish().is_some()
        {
            return;
        }
        let start = self.run.start_time().unwrap_or(now);
        let drift = round2(now - (start + f64::from(self.ticks + 1) * 1000.0));
        if drift < 0.0 {
            return;
        }
        if self.drift.record(drift, self.config.monitors_drift()) {
            self.finish(now, date, Some("slow timer".into()));
            return;
        }
        let due = ((now - start) / 1000.0).floor() as u32;
        while self.run.active() && self.run.pending_finish().is_none() && self.ticks < due {
            self.ticks += 1;
            let mut data = json!({"event":"step","timer":self.ticks});
            if self.drift.slow_timer() {
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
            let limit = self.time_limit();
            if limit.is_some_and(|limit| limit > 0.0 && f64::from(self.ticks) >= limit) {
                self.finish(now, date, None);
            }
        }
    }

    pub(super) fn observe(
        &mut self,
        kind: &str,
        now: f64,
        mut data: Value,
    ) -> Result<(), crate::error::EngineError> {
        // Result loading may yield after finalization. New observations must
        // not extend a finished test's keyboard timeline. Still allow releases
        // of already-held keys, including finalize()'s estimated releases.
        if (self.run.ended() || self.run.pending_finish().is_some()) && kind != "keyup" {
            return Ok(());
        }
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

    pub(super) fn finalize(&mut self) {
        let average = self.recorder.average_key_duration();
        for (key, now) in self.pressed.clone() {
            let _ = self.observe("keyup", now + average, json!({"code":key,"estimated":true}));
        }
        self.recorder.trim_to_timer();
        self.live = crate::live::Live::default();
        for event in self.recorder.events() {
            self.live.record(
                &event.kind,
                event.now,
                &event.data,
                &self.words,
                self.korean,
            );
        }
    }
}
