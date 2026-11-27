//! Legacy event-log derivation. Text offsets/counts remain UTF-16 units.
use crate::{
    Text, js_round, round2,
    session::Event,
    text::{is_space, js_whitespace},
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeSet;
use ts_rs::TS;

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Context {
    pub target_words: Vec<Text>,
    pub mode: String,
    pub mode2: String,
    #[serde(default)]
    pub bailed_out: bool,
    #[serde(default)]
    pub korean_status: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub custom_text_limit_mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub custom_text_limit_value: Option<f64>,
}
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
pub struct Log {
    pub version: u32,
    pub events: Vec<Event>,
    pub context: Context,
}

pub(crate) fn contains_korean(word: &Text) -> bool {
    word.0.iter().any(|c| matches!(*c,0xac00..=0xd7af | 0x1100..=0x11ff | 0x3130..=0x318f | 0xa960..=0xa97f | 0xd7b0..=0xd7ff))
}
pub fn text(value: &Value) -> Text {
    if let Some(value) = value.as_str() {
        Text::from(value)
    } else {
        serde_json::from_value(value.clone()).unwrap_or_default()
    }
}
pub fn word_index(event: &Event) -> Option<usize> {
    event.data["wordIndex"].as_u64().map(|v| v as usize)
}
fn is_insert(event: &Event) -> bool {
    event.kind == "input"
        && (event.data["inputType"] == "insertText"
            || event.data["inputType"] == "insertCompositionText")
}
pub fn input(events: &[&Event]) -> Text {
    let Some(event) = events.iter().rev().find(|event| event.kind == "input") else {
        return Text::default();
    };
    input_value(&event.data)
}
pub(crate) fn input_value(data: &Value) -> Text {
    let mut value = text(&data["inputValue"]);
    if data["inputType"] == "insertText"
        && text(&data["data"]).0 == [32]
        && data["lastWord"] == true
        && data["commitsWord"] == true
        && data["correct"] == false
    {
        while value.0.last().is_some_and(|c| js_whitespace(*c)) {
            value.0.pop();
        }
    }
    value
}
struct WordPositions {
    // Flat [key0, val0, key1, val1, ...] to reuse Vec<usize> in Wasm.
    slots: Vec<usize>,
    len: usize,
}
impl WordPositions {
    fn new() -> Self {
        Self {
            slots: vec![],
            len: 0,
        }
    }
    fn slot(slots: &[usize], key: usize) -> usize {
        let mask = (slots.len() >> 1) - 1;
        let mut idx = key.wrapping_mul(2_654_435_761) & mask;
        loop {
            let entry = slots[idx << 1];
            if entry == usize::MAX || entry == key {
                return idx << 1;
            }
            idx = (idx + 1) & mask;
        }
    }
    fn get(&self, key: usize) -> Option<usize> {
        if self.slots.is_empty() {
            return None;
        }
        let off = Self::slot(&self.slots, key);
        (self.slots[off] == key).then_some(self.slots[off + 1])
    }
    #[inline(never)]
    fn insert(&mut self, key: usize, value: usize) {
        if self.len * 4 >= self.slots.len() {
            let cap = (self.slots.len() * 2).max(32);
            let mut next = vec![usize::MAX; cap];
            for &[k, v] in self.slots.as_chunks::<2>().0 {
                if k != usize::MAX {
                    let off = Self::slot(&next, k);
                    next[off] = k;
                    next[off + 1] = v;
                }
            }
            self.slots = next;
        }
        let off = Self::slot(&self.slots, key);
        if self.slots[off] == usize::MAX {
            self.len += 1;
        }
        self.slots[off] = key;
        self.slots[off + 1] = value;
    }
}

#[inline(never)]
pub(crate) fn per_word(log: &Log, limit: Option<f64>) -> Vec<(usize, Vec<&Event>)> {
    let mut words: Vec<(usize, Vec<&Event>)> = vec![];
    let mut positions = WordPositions::new();
    for event in &log.events {
        if limit.is_some_and(|limit| event.test_ms > limit) {
            break;
        }
        if let Some(index) = word_index(event) {
            if let Some(pos) = positions.get(index) {
                words[pos].1.push(event);
            } else {
                positions.insert(index, words.len());
                words.push((index, vec![event]));
            }
        }
    }
    words
}
pub(crate) fn is_space_insert(data: &Value) -> bool {
    data["inputType"] == "insertText" && text(&data["data"]).0 == [32]
}
fn active_index(words: &[(usize, Vec<&Event>)]) -> usize {
    let last = words
        .iter()
        .filter(|(_, events)| !input(events).is_empty())
        .max_by_key(|(i, _)| *i);
    let Some((index, events)) = last else {
        return 0;
    };
    let space = events.last().is_some_and(|e| is_space_insert(&e.data));
    *index + usize::from(space)
}
pub fn timed(log: &Log) -> bool {
    log.context.mode == "time"
        || (log.context.mode == "words" && log.context.mode2 == "0")
        || (log.context.mode == "custom"
            && (log.context.custom_text_limit_mode.as_deref() == Some("time")
                || log.context.custom_text_limit_value == Some(0.0)))
}
#[derive(Default, Debug, Clone, PartialEq, Eq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Chars {
    pub all_correct: usize,
    pub correct_word: usize,
    pub incorrect: usize,
    pub extra: usize,
    pub missed: usize,
}
pub fn count_chars(input: &Text, target: &Text, partial: bool) -> Chars {
    let correct = input == target;
    let prefix = target.0.starts_with(&input.0);
    let mut chars = Chars::default();
    for index in 0..input.len().max(target.len()) {
        let a = input.0.get(index);
        let b = target.0.get(index);
        if a == b {
            if b == Some(&32) && !correct {
                chars.extra += 1;
            } else {
                chars.all_correct += 1;
            }
            if correct || (partial && prefix) {
                chars.correct_word += 1;
            }
        } else if a.is_none() {
            if !partial {
                chars.missed += 1;
            }
        } else if b.is_none() || (b == Some(&32) && a != Some(&32) && !input.0.contains(&32)) {
            chars.extra += 1;
        } else {
            chars.incorrect += 1;
        }
    }
    chars
}
#[inline(never)]
pub(crate) fn count_word_pair(
    typed_raw: &Text,
    target: Option<&Text>,
    korean: bool,
) -> (Chars, Chars) {
    let mut typed = typed_raw.clone();
    for unit in &mut typed.0 {
        if is_space(*unit) {
            *unit = 32;
        }
    }
    let target = target.unwrap_or(&typed).clone();
    let (typed, target) = if korean {
        (
            crate::text::disassemble_hangul(&typed),
            crate::text::disassemble_hangul(&target),
        )
    } else {
        (typed, target)
    };
    (
        count_chars(&typed, &target, false),
        count_chars(&typed, &target, true),
    )
}
pub fn chars(log: &Log, partial: bool, limit: Option<f64>) -> Chars {
    let words = per_word(log, limit);
    let active = active_index(&words);
    let mut total = Chars::default();
    for (index, events) in words {
        let typed = input(&events);
        let (full, part) = count_word_pair(
            &typed,
            log.context.target_words.get(index),
            log.context.korean_status,
        );
        let counts = if index == active && (partial || timed(log) || log.context.bailed_out) {
            part
        } else {
            full
        };
        total.all_correct += counts.all_correct;
        total.correct_word += counts.correct_word;
        total.incorrect += counts.incorrect;
        total.extra += counts.extra;
        total.missed += counts.missed;
        if index == active {
            break;
        }
    }
    total
}
pub fn wpm(chars: usize, seconds: f64) -> f64 {
    if seconds <= 0.0 {
        0.0
    } else {
        chars as f64 / 5.0 / (seconds / 60.0)
    }
}
#[derive(Serialize, TS)]
pub struct Accuracy {
    pub correct: usize,
    pub incorrect: usize,
    pub percentage: f64,
}
pub fn accuracy_counts(log: &Log, limit: Option<f64>) -> Accuracy {
    let mut counts = Accuracy {
        correct: 0,
        incorrect: 0,
        percentage: 0.0,
    };
    for event in &log.events {
        if limit.is_some_and(|limit| event.test_ms > limit) {
            break;
        }
        if event.kind == "input" && event.data.get("correct").is_some() {
            if event.data["correct"] == true {
                counts.correct += 1;
            } else {
                counts.incorrect += 1;
            }
        }
    }
    let total = counts.correct + counts.incorrect;
    if total != 0 {
        counts.percentage = counts.correct as f64 / total as f64 * 100.0;
    }
    counts
}
pub fn accuracy(log: &Log, limit: Option<f64>) -> f64 {
    accuracy_counts(log, limit).percentage
}

fn end(log: &Log) -> f64 {
    log.events
        .iter()
        .rev()
        .find(|event| event.kind == "timer" && event.data["event"] == "end")
        .map(|event| event.test_ms)
        .unwrap_or(0.0)
}
fn raw_last_key_to_end(log: &Log) -> f64 {
    let last = log
        .events
        .iter()
        .rev()
        .find(|event| event.kind == "keydown");
    // Pre-start keydowns are retained for holds, but contribute no time before
    // zero to key spacing or startToFirstKey. Use the same origin at this end.
    last.map(|event| round2((end(log) - event.test_ms.max(0.0)).max(0.0)))
        .unwrap_or(0.0)
}
fn adjusted_end(log: &Log) -> f64 {
    let mut end = end(log);
    if log.context.mode == "zen" || log.context.bailed_out {
        let last = raw_last_key_to_end(log);
        if last < 7000.0 {
            end -= last;
        }
    }
    end
}
pub fn duration(log: &Log) -> f64 {
    let end = adjusted_end(log);
    if log.context.mode == "custom" {
        end
    } else {
        round2(end / 1000.0) * 1000.0
    }
}
pub fn boundaries(log: &Log) -> Vec<f64> {
    if !log
        .events
        .iter()
        .any(|event| event.kind == "timer" && event.data["event"] == "end")
    {
        return vec![];
    }
    let end = adjusted_end(log);
    let ticks =
        ((end / 1000.0).floor().max(0.0) as usize).min(crate::validation::MAX_HISTORY_TICKS);
    let mut boundaries: Vec<_> = (1..=ticks).map(|i| i as f64 * 1000.0).collect();
    if !timed(log) && js_round(round2(end / 1000.0) % 1.0) >= 0.5 {
        boundaries.push(end);
    }
    boundaries
}
fn count_intervals(log: &Log, predicate: impl Fn(&Event) -> bool) -> Vec<usize> {
    let mut index = 0;
    let mut counts = vec![];
    for boundary in boundaries(log) {
        let mut count = 0;
        while let Some(event) = log.events.get(index) {
            if event.test_ms > boundary {
                break;
            }
            if predicate(event) {
                count += 1;
            }
            index += 1;
        }
        counts.push(count);
    }
    counts
}
pub fn keypresses_per_second(log: &Log) -> Vec<usize> {
    count_intervals(log, |event| {
        event.kind == "input" && event.data["inputType"] == "insertText"
    })
}
pub fn burst_history(log: &Log) -> Vec<f64> {
    let counts = keypresses_per_second(log);
    let mut previous = 0.0;
    boundaries(log)
        .iter()
        .zip(counts)
        .map(|(boundary, count)| {
            let seconds = (boundary - previous) / 1000.0;
            previous = *boundary;
            js_round(wpm(count, seconds))
        })
        .collect()
}
struct Fenwick(Vec<usize>);
impl Fenwick {
    #[inline(never)]
    fn push_zero(&mut self) {
        let idx = self.0.len();
        let stop = idx - idx.isolate_lowest_one();
        let mut sum = 0usize;
        let mut child = idx - 1;
        while child > stop {
            sum = sum.wrapping_add(self.0[child]);
            child -= child.isolate_lowest_one();
        }
        self.0.push(sum);
    }
    #[inline(never)]
    fn add(&mut self, pos: usize, delta: usize) {
        if delta == 0 {
            return;
        }
        let mut idx = pos + 1;
        while idx < self.0.len() {
            self.0[idx] = self.0[idx].wrapping_add(delta);
            idx += idx.isolate_lowest_one();
        }
    }
    #[inline(never)]
    fn prefix_sum(&self, count: usize) -> usize {
        let mut idx = count.min(self.0.len().saturating_sub(1));
        let mut sum = 0usize;
        while idx > 0 {
            sum = sum.wrapping_add(self.0[idx]);
            idx -= idx.isolate_lowest_one();
        }
        sum
    }
}

fn word_speed_metrics(log: &Log, index: usize, typed_raw: &Text, raw: bool) -> (usize, usize) {
    let (full, partial) = count_word_pair(
        typed_raw,
        log.context.target_words.get(index),
        log.context.korean_status,
    );
    let pick = |counts: Chars| {
        if raw {
            counts.all_correct + counts.incorrect + counts.extra
        } else {
            counts.correct_word
        }
    };
    (pick(full), pick(partial))
}

#[inline(never)]
pub fn speed_history(log: &Log, raw: bool) -> Vec<f64> {
    let bounds = boundaries(log);
    let mut history = Vec::with_capacity(bounds.len());
    let mut positions = WordPositions::new();
    // Flat [full, partial, last_event_is_space] per word to reuse Vec<usize>.
    let mut words: Vec<usize> = vec![];
    let mut bit = Fenwick(vec![0]);
    let mut nonempty: BTreeSet<usize> = BTreeSet::new();
    let mut event_idx = 0usize;

    for boundary in bounds {
        while let Some(event) = log.events.get(event_idx) {
            if event.test_ms > boundary {
                break;
            }
            event_idx += 1;
            let Some(index) = word_index(event) else {
                continue;
            };
            let is_space_insert = usize::from(is_space_insert(&event.data));
            let (pos, created) = if let Some(pos) = positions.get(index) {
                words[pos * 3 + 2] = is_space_insert;
                (pos, false)
            } else {
                let pos = words.len() / 3;
                positions.insert(index, pos);
                words.push(0);
                words.push(0);
                words.push(is_space_insert);
                bit.push_zero();
                (pos, true)
            };
            if created || event.kind == "input" {
                let typed = if event.kind == "input" {
                    input_value(&event.data)
                } else {
                    Text::default()
                };
                if typed.is_empty() {
                    nonempty.remove(&index);
                } else {
                    nonempty.insert(index);
                }
                let (full, partial) = word_speed_metrics(log, index, &typed, raw);
                let delta = full.wrapping_sub(words[pos * 3]);
                words[pos * 3] = full;
                words[pos * 3 + 1] = partial;
                bit.add(pos, delta);
            }
        }
        let active = match nonempty.last() {
            Some(&max_index) => {
                let pos = positions.get(max_index).unwrap_or(0);
                max_index + words[pos * 3 + 2]
            }
            None => 0,
        };
        let char_count = if let Some(active_pos) = positions.get(active) {
            bit.prefix_sum(active_pos) + words[active_pos * 3 + 1]
        } else {
            bit.prefix_sum(words.len() / 3)
        };
        history.push(js_round(wpm(char_count, boundary / 1000.0)));
    }
    history
}
pub fn afk(log: &Log) -> usize {
    count_intervals(log, |e| e.kind == "keydown" || e.kind == "input")
        .iter()
        .filter(|count| **count == 0)
        .count()
}
pub fn incomplete_seconds(log: &Log) -> f64 {
    round2(duration(log) / 1000.0 - afk(log) as f64).max(0.0)
}
pub fn consistency(values: &[f64]) -> f64 {
    if values.is_empty() {
        return 0.0;
    }
    let mean = values.iter().sum::<f64>() / values.len() as f64;
    let deviation = (values
        .iter()
        .map(|value| (value - mean).powi(2))
        .sum::<f64>()
        / values.len() as f64)
        .sqrt();
    let cov = deviation / mean;
    let result = round2(100.0 * (1.0 - (cov + cov.powi(3) / 3.0 + cov.powi(5) / 5.0).tanh()));
    if result.is_nan() { 0.0 } else { result }
}
pub fn word_burst(log: &Log, index: usize, now: f64) -> f64 {
    let events: Vec<_> = log
        .events
        .iter()
        .filter(|e| word_index(e) == Some(index))
        .collect();
    let input = input(&events);
    let mut first = None;
    let mut last = None;
    for event in events {
        if event.kind == "composition" && event.data["event"] == "start" && first.is_none() {
            first = Some(event.test_ms);
        }
        if is_insert(event) {
            if event.data["charIndex"] == 0 && first.is_none() {
                first = Some(event.test_ms);
            }
            if first.is_some() {
                last = Some(event.test_ms);
            }
        }
    }
    burst(&input, first, last, now)
}
pub(crate) fn burst(input: &Text, first: Option<f64>, last: Option<f64>, now: f64) -> f64 {
    let length = input.len() + usize::from(!matches!(input.0.last(), Some(32 | 10)));
    let Some(first) = first else {
        return 0.0;
    };
    if input.is_empty() {
        return 0.0;
    }
    let seconds = (last.filter(|last| *last >= first).unwrap_or(now) - first) / 1000.0;
    if seconds <= 0.0 {
        f64::INFINITY
    } else {
        js_round(wpm(length, seconds))
    }
}
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
pub struct ChartData {
    pub wpm: Vec<f64>,
    pub burst: Vec<f64>,
    pub err: Vec<usize>,
}
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Summary {
    pub wpm: f64,
    pub raw_wpm: f64,
    pub char_stats: [usize; 4],
    pub char_total: usize,
    pub acc: f64,
    pub test_duration: f64,
    pub last_key_to_end: f64,
    pub start_to_first_key: f64,
    pub afk_duration: usize,
    pub consistency: f64,
    pub wpm_consistency: f64,
    pub key_consistency: f64,
    pub chart_data: ChartData,
    pub key_spacing: Vec<f64>,
    pub key_duration: Vec<f64>,
    pub key_overlap: f64,
}
pub fn typed_summary(log: &Log) -> Result<Summary, crate::error::EngineError> {
    let summary = build_summary(log);
    if ![
        summary.wpm,
        summary.raw_wpm,
        summary.acc,
        summary.test_duration,
        summary.last_key_to_end,
        summary.start_to_first_key,
        summary.consistency,
        summary.wpm_consistency,
        summary.key_consistency,
        summary.key_overlap,
    ]
    .into_iter()
    .chain(summary.chart_data.wpm.iter().copied())
    .chain(summary.chart_data.burst.iter().copied())
    .chain(summary.key_spacing.iter().copied())
    .chain(summary.key_duration.iter().copied())
    .all(f64::is_finite)
    {
        return Err(crate::error::EngineError::new(
            crate::error::ErrorCode::InvalidLog,
            "Unrepresentable result metrics: non-finite number",
        ));
    }
    Ok(summary)
}
pub fn summary(log: &Log) -> Value {
    serde_json::to_value(build_summary(log)).expect("Serializable summary")
}
pub(crate) fn build_summary(log: &Log) -> Summary {
    let counts = chars(log, false, None);
    let seconds = duration(log) / 1000.0;
    let burst = burst_history(log);
    let speed = speed_history(log, false);
    let errors = count_intervals(log, |event| {
        event.kind == "input"
            && event.data["inputType"] == "insertText"
            && event.data["correct"] == false
    });
    let KeyTiming {
        spacing,
        durations,
        overlap,
        first,
    } = key_timing(log);
    Summary {
        wpm: round2(wpm(counts.correct_word, seconds)),
        raw_wpm: round2(wpm(
            counts.all_correct + counts.incorrect + counts.extra,
            seconds,
        )),
        char_stats: [
            counts.correct_word,
            counts.incorrect,
            counts.extra,
            counts.missed,
        ],
        char_total: counts.all_correct + counts.incorrect + counts.extra,
        acc: round2(accuracy(log, None)),
        test_duration: seconds,
        last_key_to_end: if log.context.mode == "zen" {
            0.0
        } else {
            raw_last_key_to_end(log)
        },
        start_to_first_key: if log.context.mode == "zen" {
            0.0
        } else {
            round2(first)
        },
        afk_duration: afk(log),
        consistency: consistency(&burst),
        wpm_consistency: consistency(&speed),
        key_consistency: consistency(&spacing[..spacing.len().saturating_sub(1)]),
        chart_data: ChartData {
            wpm: speed,
            burst,
            err: errors,
        },
        key_spacing: spacing,
        key_duration: durations,
        key_overlap: round2(overlap),
    }
}

pub fn input_history(log: &Log) -> Vec<Text> {
    let words = per_word(log, None);
    words
        .iter()
        .map(|(index, events)| {
            let Some(last) = events.last() else {
                return Text::default();
            };
            let abandoned = words
                .iter()
                .find(|(previous, _)| *previous + 1 == *index)
                .is_some_and(|(_, previous)| {
                    previous.iter().any(|event| {
                        event.test_ms > last.test_ms && event.data["clearedNextWord"] == true
                    })
                });
            if abandoned {
                Text::default()
            } else {
                input(events)
            }
        })
        .collect()
}
pub fn missed_words(log: &Log) -> Vec<(Text, usize)> {
    let mut words: Vec<(Text, usize)> = vec![];
    for event in &log.events {
        if event.kind != "input"
            || event.data["inputType"] != "insertText"
            || event.data["correct"] == true
        {
            continue;
        }
        let Some(word) = word_index(event).and_then(|index| log.context.target_words.get(index))
        else {
            continue;
        };
        let mut word = word.clone();
        if matches!(word.0.last(), Some(32 | 10)) {
            word.0.pop();
        }
        if let Some((_, count)) = words.iter_mut().find(|(text, _)| text == &word) {
            *count += 1;
        } else {
            words.push((word, 1));
        }
    }
    // JS Object.keys: canonical uint32 integer keys precede insertion order.
    words.sort_by_key(|(text, _)| {
        let value = text.display_lossy();
        value
            .parse::<u32>()
            .ok()
            .filter(|n| *n < u32::MAX && n.to_string() == value)
            .map_or((true, 0), |n| (false, n))
    });
    words
}
pub fn corrected_history(log: &Log) -> Vec<Text> {
    per_word(log, None)
        .into_iter()
        .map(|(_, events)| {
            let mut current: Vec<Option<Text>> = vec![];
            let mut corrected: Vec<Option<Text>> = vec![];
            let mut cursor = 0;
            for event in events {
                if event.kind != "input" {
                    continue;
                }
                if event.data["inputType"] == "insertText"
                    || event.data["inputType"] == "insertCompositionText"
                {
                    if event.data["inputStopped"] == true {
                        continue;
                    }
                    current.resize(current.len().max(cursor + 1), None);
                    current[cursor] = Some(text(&event.data["data"]));
                    cursor += 1;
                } else if event.data["inputType"] == "deleteContentBackward"
                    || event.data["inputType"] == "deleteWordBackward"
                {
                    let all = event.data["inputType"] == "deleteWordBackward";
                    while cursor > 0 {
                        cursor -= 1;
                        corrected.resize(corrected.len().max(cursor + 1), None);
                        corrected[cursor] = current
                            .get(cursor)
                            .cloned()
                            .flatten()
                            .or(Some(Text::default()));
                        if !all {
                            break;
                        }
                    }
                }
            }
            Text(
                current
                    .iter()
                    .enumerate()
                    .flat_map(|(index, value)| {
                        corrected
                            .get(index)
                            .and_then(Option::as_ref)
                            .or(value.as_ref())
                            .map_or(vec![], |text| text.0.clone())
                    })
                    .collect(),
            )
        })
        .collect()
}
pub fn word_burst_history(log: &Log, now: f64) -> Vec<f64> {
    (0..per_word(log, None).len())
        .map(|index| word_burst(log, index, now))
        .collect()
}
pub fn word_indexes_for_second(log: &Log, second: usize) -> Vec<usize> {
    let boundaries = boundaries(log);
    let Some(boundary) = boundaries.get(second) else {
        return vec![];
    };
    let previous = second
        .checked_sub(1)
        .and_then(|index| boundaries.get(index));
    let mut words = vec![];
    for event in &log.events {
        if previous.is_some_and(|previous| event.test_ms <= *previous) {
            continue;
        }
        if event.test_ms > *boundary {
            break;
        }
        if let Some(index) = word_index(event)
            && !words.contains(&index)
        {
            words.push(index);
        }
    }
    words
}

pub fn lagged_boundaries(log: &Log) -> Vec<f64> {
    let mut boundaries: Vec<_> = log
        .events
        .iter()
        .filter(|event| event.kind == "timer" && event.data["event"] == "step")
        .map(|event| event.test_ms)
        .collect();
    let has_end = log
        .events
        .iter()
        .any(|event| event.kind == "timer" && event.data["event"] == "end");
    let end = adjusted_end(log);
    if has_end && (log.context.mode == "zen" || log.context.bailed_out) {
        while boundaries.last().is_some_and(|boundary| *boundary > end) {
            boundaries.pop();
        }
    }
    if has_end && !timed(log) && js_round(round2(end / 1000.0) % 1.0) >= 0.5 {
        boundaries.push(end);
    }
    boundaries
}
#[inline(never)]
pub fn boundary_labels(log: &Log, show_lag: bool) -> Vec<String> {
    let boundaries = boundaries(log);
    boundaries
        .iter()
        .enumerate()
        .map(|(index, boundary)| {
            if index + 1 == boundaries.len()
                && (boundary - (index + 1) as f64 * 1000.0).abs() > 100.0
            {
                return format!("{:.2}", round2(boundary / 1000.0));
            }
            let previous = index.checked_sub(1).map_or(0.0, |index| boundaries[index]);
            if show_lag
                && log.events.iter().any(|event| {
                    event.kind == "timer"
                        && event.data["event"] == "step"
                        && event.data["catchup"] == true
                        && event.test_ms > previous
                        && event.test_ms <= *boundary
                })
            {
                "LAG".into()
            } else {
                (index + 1).to_string()
            }
        })
        .collect()
}

pub struct KeyTiming {
    pub spacing: Vec<f64>,
    pub durations: Vec<f64>,
    pub overlap: f64,
    pub first: f64,
}
#[inline(never)]
pub fn key_timing(log: &Log) -> KeyTiming {
    let mut spacing = vec![];
    let mut last = None;
    let mut durations: Vec<f64> = vec![];
    let mut held: Vec<(&str, f64, usize)> = vec![];
    let mut overlap = 0.0;
    let mut overlap_start = None;
    let start = log
        .events
        .iter()
        .find(|event| event.kind == "timer" && event.data["event"] == "start")
        .map(|event| event.test_ms);
    let first = log
        .events
        .iter()
        .find(|event| event.kind == "keydown")
        .map(|event| (event.test_ms - start.unwrap_or(event.test_ms)).max(0.0))
        .unwrap_or(0.0);
    for event in &log.events {
        let code = event.data["code"].as_str().unwrap_or_default();
        if event.kind == "keydown" {
            if let Some(previous) = last {
                spacing.push(event.test_ms - previous);
            }
            last = Some(event.test_ms.max(0.0));
            if let Some(index) = held.iter().position(|(key, _, _)| key == &code) {
                held.remove(index);
            }
            held.push((code, event.test_ms, durations.len()));
            durations.push(0.0);
            if overlap_start.is_none() && held.len() > 1 {
                overlap_start = Some(event.test_ms);
            }
        } else if event.kind == "keyup" {
            if let Some(index) = held.iter().position(|(key, _, _)| key == &code) {
                let (_, time, index) = held.remove(index);
                durations[index] = event.test_ms - time;
            }
            if let Some(start) = overlap_start
                && held.len() == 1
            {
                overlap += event.test_ms - start;
                overlap_start = None;
            }
        }
    }
    KeyTiming {
        spacing,
        durations,
        overlap,
        first,
    }
}
