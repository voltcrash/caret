use crate::{
    Config, round2,
    stats::{self, Log},
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use ts_rs::TS;

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
pub struct QuoteRef {
    pub id: u32,
    pub group: usize,
}
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CustomTextMetrics {
    pub text_len: usize,
    pub mode: String,
    pub pipe_delimiter: bool,
    pub limit: Limit,
}
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
pub struct IncompleteTest {
    pub acc: f64,
    pub seconds: f64,
}
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CompletedMetrics {
    #[serde(flatten)]
    pub summary: stats::Summary,
    pub client: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub offline: Option<bool>,
    pub language: String,
    pub tags: Vec<String>,
    pub punctuation: bool,
    pub numbers: bool,
    pub lazy_mode: bool,
    pub timestamp: f64,
    pub mode: String,
    pub mode2: String,
    pub bailed_out: bool,
    pub funbox: Vec<String>,
    pub difficulty: String,
    pub blind_mode: bool,
    pub stop_on_letter: bool,
    pub restart_count: u32,
    pub incomplete_tests: Vec<IncompleteTest>,
    pub incomplete_test_seconds: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub custom_text: Option<CustomTextMetrics>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub quote_length: Option<i32>,
}
pub fn typed_completed(
    log: &Log,
    context: &CompletedContext,
) -> Result<CompletedMetrics, crate::error::EngineError> {
    serde_json::from_value(completed(log, context)).map_err(|error| {
        crate::error::EngineError::new(
            crate::error::ErrorCode::InvalidLog,
            format!("Unrepresentable completed result: {error}"),
        )
    })
}
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CompletedContext {
    pub client: Option<String>,
    pub offline: Option<bool>,
    pub config: Config,
    pub current_quote: Option<QuoteRef>,
    pub custom_text: Option<CustomTextMetrics>,
    pub tags: Vec<String>,
    pub bailed_out: bool,
    pub restart_count: u32,
    pub incomplete_tests: Vec<IncompleteTest>,
    pub incomplete_seconds: f64,
    pub timestamp: f64,
}
pub fn mode2(config: &Config, quote: Option<&QuoteRef>) -> String {
    match config.mode.as_str() {
        "time" => config.time.to_string(),
        "words" => config.words.to_string(),
        "quote" => quote.map_or_else(|| "-1".into(), |quote| quote.id.to_string()),
        other => other.into(),
    }
}
pub fn completed(log: &Log, context: &CompletedContext) -> Value {
    let config = &context.config;
    let mut value = stats::summary(log);
    let object = value.as_object_mut().expect("summary object");
    let metadata = json!({
        "client": context.client.as_deref().unwrap_or("web"),
        "language": if config.mode == "quote" { crate::quotes::remove_language_size(&config.language) } else { config.language.clone() },
        "tags": context.tags, "punctuation": config.punctuation, "numbers": config.numbers,
        "lazyMode": config.lazy_mode, "timestamp": context.timestamp, "mode": config.mode,
        "mode2": mode2(config,context.current_quote.as_ref()), "bailedOut": context.bailed_out,
        "funbox": config.funbox, "difficulty": config.difficulty, "blindMode": config.blind_mode,
        "stopOnLetter": config.stop_on_error == "letter", "restartCount": context.restart_count,
        "incompleteTests": context.incomplete_tests,
        "incompleteTestSeconds": if context.incomplete_seconds < 0.0 { 0.0 } else { round2(context.incomplete_seconds) }
    });
    object.extend(metadata.as_object().expect("metadata object").clone());
    if let Some(offline) = context.offline {
        object.insert("offline".into(), json!(offline));
    }
    if config.mode == "custom"
        && let Some(custom) = &context.custom_text
    {
        object.insert("customText".into(), json!(custom));
    }
    if config.mode == "quote" {
        object.insert(
            "quoteLength".into(),
            json!(
                context
                    .current_quote
                    .as_ref()
                    .map_or(-1, |quote| quote.group as i64)
            ),
        );
    }
    value
}
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ValidityResult {
    pub mode: String,
    pub mode2: String,
    pub test_duration: f64,
    pub wpm: f64,
    pub raw_wpm: f64,
    pub acc: f64,
}
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
pub struct Limit {
    pub mode: String,
    pub value: f64,
}
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Validity {
    pub result: ValidityResult,
    pub bailed_out: bool,
    pub failed: bool,
    pub repeated: bool,
    pub lb_opt_out: bool,
    pub custom_limit: Limit,
}
pub fn date_duration(log: &Log) -> f64 {
    let find = |kind: &str| {
        log.events
            .iter()
            .find(|event| event.kind == "timer" && event.data["event"] == kind)
            .and_then(|event| event.data["date"].as_f64())
    };
    match (find("start"), find("end")) {
        (Some(start), Some(end)) => end - start,
        _ => 0.0,
    }
}
pub fn is_afk(log: &Log, bailed_out: bool) -> bool {
    !bailed_out
        && stats::keypresses_per_second(log)
            .iter()
            .rev()
            .take(5)
            .all(|count| *count == 0)
}
pub fn invalid_reason(log: &Log, input: &Validity) -> Option<&'static str> {
    let result = &input.result;
    let mode = result.mode.as_str();
    // JS parseInt consumes an initial signed integer and ignores a suffix.
    let mut chars = result.mode2.trim_start().chars().peekable();
    let mut number = String::new();
    if chars.peek().is_some_and(|c| *c == '-' || *c == '+') {
        number.push(chars.next().unwrap());
    }
    number.extend(chars.take_while(char::is_ascii_digit));
    let mode2 = number.parse::<f64>().unwrap_or(f64::NAN);
    let date = date_duration(log) / 1000.0;
    if mode == "time"
        && !input.bailed_out
        && (result.test_duration < date - 0.1 || result.test_duration > date + 0.1)
        && result.test_duration <= 120.0
    {
        return Some("inconsistent duration");
    }
    if input.failed {
        return Some("failed");
    }
    if result.test_duration < 1.0
        || (mode == "time" && mode2 < 15.0 && mode2 > 0.0)
        || (mode == "time" && mode2 == 0.0 && result.test_duration < 15.0)
        || (mode == "words" && mode2 < 10.0 && mode2 > 0.0)
        || (mode == "words" && mode2 == 0.0 && result.test_duration < 15.0)
        || (mode == "custom"
            && ((["word", "section"].contains(&input.custom_limit.mode.as_str())
                && input.custom_limit.value < 10.0)
                || (input.custom_limit.mode == "time" && input.custom_limit.value < 15.0)))
        || (mode == "zen" && result.test_duration < 15.0)
    {
        return Some("too short");
    }
    if is_afk(log, input.bailed_out) {
        return Some("afk");
    }
    if input.repeated {
        return Some("repeated");
    }
    let invalid_speed = |speed: f64| {
        speed < 0.0
            || (speed > 350.0 && mode != "words" && result.mode2 != "10")
            || (speed > 420.0 && mode == "words" && result.mode2 == "10")
    };
    if invalid_speed(result.wpm) {
        return Some("wpm");
    }
    if invalid_speed(result.raw_wpm) {
        return Some("raw");
    }
    if result.acc < if input.lb_opt_out { 50.0 } else { 75.0 } || result.acc > 100.0 {
        return Some("accuracy");
    }
    None
}
