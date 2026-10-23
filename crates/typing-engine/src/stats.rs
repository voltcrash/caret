//! Legacy event-log derivation. Text offsets/counts remain UTF-16 units.
use crate::{
    Text, js_round, round2,
    session::Event,
    text::{is_space, js_whitespace},
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
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
    let mut value = text(&event.data["inputValue"]);
    if event.data["inputType"] == "insertText"
        && text(&event.data["data"]).0 == [32]
        && event.data["lastWord"] == true
        && event.data["commitsWord"] == true
        && event.data["correct"] == false
    {
        while value.0.last().is_some_and(|c| js_whitespace(*c)) {
            value.0.pop();
        }
    }
    value
}
pub(crate) fn per_word(log: &Log, limit: Option<f64>) -> Vec<(usize, Vec<&Event>)> {
    let mut words: Vec<(usize, Vec<&Event>)> = vec![];
    for event in &log.events {
        if limit.is_some_and(|limit| event.test_ms > limit) {
            break;
        }
        if let Some(index) = word_index(event) {
            if let Some((_, events)) = words.iter_mut().find(|(i, _)| *i == index) {
                events.push(event);
            } else {
                words.push((index, vec![event]));
            }
        }
    }
    words
}
fn active_index(words: &[(usize, Vec<&Event>)]) -> usize {
    let last = words
        .iter()
        .filter(|(_, events)| !input(events).is_empty())
        .max_by_key(|(i, _)| *i);
    let Some((index, events)) = last else {
        return 0;
    };
    let space = events
        .last()
        .is_some_and(|e| e.data["inputType"] == "insertText" && text(&e.data["data"]).0 == [32]);
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
pub fn chars(log: &Log, partial: bool, limit: Option<f64>) -> Chars {
    let words = per_word(log, limit);
    let active = active_index(&words);
    let mut total = Chars::default();
    for (index, events) in words {
        let mut typed = input(&events);
        for unit in &mut typed.0 {
            if is_space(*unit) {
                *unit = 32;
            }
        }
        let target = log
            .context
            .target_words
            .get(index)
            .unwrap_or(&typed)
            .clone();
        let (typed, target) = if log.context.korean_status {
            (
                crate::text::disassemble_hangul(&typed),
                crate::text::disassemble_hangul(&target),
            )
        } else {
            (typed, target)
        };
        let counts = count_chars(
            &typed,
            &target,
            index == active && (partial || timed(log) || log.context.bailed_out),
        );
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
pub fn accuracy(log: &Log, limit: Option<f64>) -> f64 {
    let mut correct = 0;
    let mut total = 0;
    for event in &log.events {
        if limit.is_some_and(|limit| event.test_ms > limit) {
            break;
        }
        if event.kind == "input" && event.data.get("correct").is_some() {
            total += 1;
            if event.data["correct"] == true {
                correct += 1;
            }
        }
    }
    if total == 0 {
        0.0
    } else {
        correct as f64 / total as f64 * 100.0
    }
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
    last.map(|event| round2((end(log) - event.test_ms).max(0.0)))
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
    let ticks = (end / 1000.0).floor() as usize;
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
pub fn speed_history(log: &Log, raw: bool) -> Vec<f64> {
    boundaries(log)
        .iter()
        .map(|boundary| {
            let chars = chars(log, true, Some(*boundary));
            js_round(wpm(
                if raw {
                    chars.all_correct + chars.incorrect + chars.extra
                } else {
                    chars.correct_word
                },
                boundary / 1000.0,
            ))
        })
        .collect()
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
    let mut length = input.len();
    if !matches!(input.0.last(), Some(32 | 10)) {
        length += 1;
    }
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
pub fn summary(log: &Log) -> Value {
    let counts = chars(log, false, None);
    let seconds = duration(log) / 1000.0;
    let burst = burst_history(log);
    let speed = speed_history(log, false);
    let errors = count_intervals(log, |event| {
        event.kind == "input"
            && event.data["inputType"] == "insertText"
            && event.data["correct"] == false
    });
    let mut spacing = vec![];
    let mut last = None;
    let mut durations: Vec<f64> = vec![];
    let mut held: Vec<(String, f64, usize)> = vec![];
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
        let code = event.data["code"].as_str().unwrap_or_default().to_owned();
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
    json!({"wpm":round2(wpm(counts.correct_word,seconds)),"rawWpm":round2(wpm(counts.all_correct+counts.incorrect+counts.extra,seconds)),
        "charStats":[counts.correct_word,counts.incorrect,counts.extra,counts.missed],"charTotal":counts.all_correct+counts.incorrect+counts.extra,
        "acc":round2(accuracy(log,None)),"testDuration":seconds,"lastKeyToEnd":if log.context.mode=="zen" {0.0} else {raw_last_key_to_end(log)},
        "startToFirstKey":if log.context.mode=="zen" {0.0} else {round2(first)},"afkDuration":afk(log),
        "consistency":consistency(&burst),"wpmConsistency":consistency(&speed),"keyConsistency":consistency(&spacing[..spacing.len().saturating_sub(1)]),
        "chartData":{"wpm":speed,"burst":burst,"err":errors},"keySpacing":spacing,"keyDuration":durations,"keyOverlap":round2(overlap)})
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
