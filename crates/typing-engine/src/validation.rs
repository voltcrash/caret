//! Bounds and shape checks at host-facing boundaries. Backend validation stays independent.
use crate::{
    Text,
    error::{EngineError, ErrorCode},
    stats::Log,
};
use serde_json::Value;
pub const MAX_WORDS: usize = 1_000_000;
pub const MAX_WORD_UNITS: usize = 1_000_000;
pub const MAX_CONTENT_UNITS: usize = 5_000_000;
pub const MAX_EVENTS: usize = 1_000_000;
pub const MAX_HISTORY_MS: f64 = 1_000_000_000.0;
pub const MAX_JSON_BYTES: usize = 64 * 1024 * 1024;
fn invalid(code: ErrorCode, message: &str) -> EngineError {
    EngineError::new(code, message)
}
pub fn words(words: &[Text]) -> Result<(), EngineError> {
    if words.len() > MAX_WORDS
        || words.iter().any(|word| word.len() > MAX_WORD_UNITS)
        || words.iter().map(Text::len).sum::<usize>() > MAX_CONTENT_UNITS
    {
        return Err(invalid(
            ErrorCode::InvalidContent,
            "Content exceeds UTF-16/count bound",
        ));
    }
    Ok(())
}
pub fn language(language: &crate::generation::Language) -> Result<(), EngineError> {
    if language.name.len() > 128
        || language
            .bcp47
            .as_ref()
            .is_some_and(|value| value.len() > 128)
        || language.additional_accents.len() > 10000
    {
        return Err(invalid(
            ErrorCode::InvalidContent,
            "Language metadata exceeds bound",
        ));
    }
    words(&language.words)?;
    if language
        .additional_accents
        .iter()
        .any(|(a, b)| a.len() > MAX_WORD_UNITS || b.len() > MAX_WORD_UNITS)
    {
        return Err(invalid(
            ErrorCode::InvalidContent,
            "Accent metadata exceeds bound",
        ));
    }
    Ok(())
}
pub fn random(random: &crate::random::Random) -> Result<(), EngineError> {
    if let crate::random::Random::Stream { values, cursor } = random
        && (values.len() > MAX_WORDS
            || *cursor > values.len()
            || values
                .iter()
                .any(|value| !value.is_finite() || !(0.0..1.0).contains(value)))
    {
        return Err(invalid(ErrorCode::InvalidInput, "Invalid random stream"));
    }
    Ok(())
}

pub fn custom(custom: &crate::generation::CustomText) -> Result<(), EngineError> {
    words(&custom.text)?;
    if custom.limit.value > MAX_WORDS {
        return Err(invalid(
            ErrorCode::InvalidContent,
            "Custom limit exceeds bound",
        ));
    }
    Ok(())
}
pub fn quote_asset(asset: &crate::quotes::QuoteAsset) -> Result<(), EngineError> {
    if asset.language.len() > 128
        || asset.groups.len() > 64
        || asset.quotes.len() > MAX_WORDS
        || asset.groups.iter().any(|(lower, upper)| lower > upper)
    {
        return Err(invalid(
            ErrorCode::InvalidContent,
            "Invalid quote asset metadata",
        ));
    }
    let mut total = 0usize;
    for quote in &asset.quotes {
        total = total
            .saturating_add(quote.text.len())
            .saturating_add(quote.british_text.as_ref().map_or(0, Text::len));
        if quote.text.len() > MAX_WORD_UNITS
            || quote
                .british_text
                .as_ref()
                .is_some_and(|text| text.len() > MAX_WORD_UNITS)
            || quote.source.len() > MAX_WORD_UNITS
            || quote.language.len() > 128
            || quote.text_split.len() > MAX_WORDS
        {
            return Err(invalid(ErrorCode::InvalidContent, "Quote exceeds bound"));
        }
    }
    if total > MAX_CONTENT_UNITS {
        return Err(invalid(
            ErrorCode::InvalidContent,
            "Quote asset exceeds UTF-16 bound",
        ));
    }
    Ok(())
}
fn text_length(value: &Value) -> Option<usize> {
    match value {
        Value::String(value) => Some(value.encode_utf16().count()),
        Value::Array(units)
            if units
                .iter()
                .all(|unit| unit.as_u64().is_some_and(|unit| unit <= 65535)) =>
        {
            Some(units.len())
        }
        _ => None,
    }
}
fn flags(data: &Value) -> bool {
    [
        "automatic",
        "isCompositionEnding",
        "inputStopped",
        "commitsWord",
        "lastWord",
        "clearedNextWord",
        "ctrl",
        "shift",
        "alt",
        "meta",
        "estimated",
        "slowTimer",
        "catchup",
    ]
    .iter()
    .all(|key| data.get(*key).is_none_or(Value::is_boolean))
}
fn finite(value: &Value) -> bool {
    value.as_f64().is_some_and(f64::is_finite)
}
pub fn observation(kind: &str, data: &Value) -> Result<(), EngineError> {
    let valid = data.as_object().is_some_and(|object| object.len() <= 32)
        && flags(data)
        && match kind {
            "keydown" | "keyup" => data["code"]
                .as_str()
                .is_some_and(|code| !code.is_empty() && code.len() <= 128),
            "composition" => {
                ["start", "update", "end"]
                    .iter()
                    .any(|kind| data["event"] == *kind)
                    && (data["event"] == "start"
                        || text_length(&data["data"]).is_some_and(|len| len <= 65536))
            }
            "timer" => {
                ["start", "step", "end"]
                    .iter()
                    .any(|kind| data["event"] == *kind)
                    && data["timer"].as_f64().is_some_and(|value| {
                        value.is_finite() && (0.0..=1_000_000.0).contains(&value)
                    })
                    && (data["event"] == "step" || finite(&data["date"]))
                    && data.get("drift").is_none_or(finite)
            }
            _ => false,
        };
    if !valid {
        return Err(invalid(
            ErrorCode::InvalidInput,
            "Invalid observation shape",
        ));
    }
    if data
        .get("wordIndex")
        .is_some_and(|index| !index.as_u64().is_some_and(|index| index < MAX_WORDS as u64))
    {
        return Err(invalid(
            ErrorCode::InvalidInput,
            "Invalid observation word index",
        ));
    }
    // Permit existing metadata but bound nested payloads before retaining them.
    let mut remaining = 100000usize;
    value(data, 0, &mut remaining)
        .map_err(|_| invalid(ErrorCode::InvalidInput, "Observation exceeds bound"))
}
fn value(data: &Value, depth: usize, remaining: &mut usize) -> Result<(), ()> {
    if depth > 16 || *remaining == 0 {
        return Err(());
    }
    *remaining -= 1;
    match data {
        Value::String(value) if value.len() > MAX_WORD_UNITS => Err(()),
        Value::Array(values) => {
            for item in values {
                value(item, depth + 1, remaining)?;
            }
            Ok(())
        }
        Value::Object(values) => {
            for (key, item) in values {
                if key.len() > 128 {
                    return Err(());
                }
                value(item, depth + 1, remaining)?;
            }
            Ok(())
        }
        _ => Ok(()),
    }
}
pub fn log(log: &Log) -> Result<(), EngineError> {
    let fail = || invalid(ErrorCode::InvalidLog, "Invalid or oversized historical log");
    if log.version != crate::EVENT_LOG_VERSION
        || log.events.len() > MAX_EVENTS
        || !["time", "words", "quote", "custom", "zen"].contains(&log.context.mode.as_str())
        || log.context.mode2.len() > 128
        || log
            .context
            .custom_text_limit_value
            .is_some_and(|v| !v.is_finite() || v < 0.0)
        || log
            .context
            .custom_text_limit_mode
            .as_ref()
            .is_some_and(|mode| !["word", "time", "section"].contains(&mode.as_str()))
    {
        return Err(fail());
    }
    words(&log.context.target_words).map_err(|_| fail())?;
    let mut previous = f64::NEG_INFINITY;
    let mut text_units = 0usize;
    for event in &log.events {
        if !event.test_ms.is_finite()
            || event.test_ms.abs() > MAX_HISTORY_MS
            || event.test_ms < previous
            || !event.data.is_object()
            || !flags(&event.data)
        {
            return Err(fail());
        }
        previous = event.test_ms;
        let data = &event.data;
        if event.kind == "input" || event.kind == "composition" {
            let index = data["wordIndex"].as_u64().ok_or_else(fail)? as usize;
            if index >= MAX_WORDS
                || (log.context.mode != "zen" && index > log.context.target_words.len())
            {
                return Err(fail());
            }
        }
        if event.kind == "input" {
            let length = text_length(&data["inputValue"]).ok_or_else(fail)?;
            text_units = text_units.saturating_add(length);
            if length > MAX_WORD_UNITS
                || text_units > MAX_JSON_BYTES
                || !data["charIndex"]
                    .as_u64()
                    .is_some_and(|index| index <= MAX_WORD_UNITS as u64)
            {
                return Err(fail());
            }
            match data["inputType"].as_str() {
                Some("insertText" | "insertCompositionText") => {
                    if !data["correct"].is_boolean()
                        || !text_length(&data["data"]).is_some_and(|len| len <= 65536)
                    {
                        return Err(fail());
                    }
                }
                Some("deleteContentBackward" | "deleteWordBackward") => {}
                _ => return Err(fail()),
            }
        } else {
            observation(&event.kind, data).map_err(|_| fail())?;
        }
    }
    Ok(())
}
