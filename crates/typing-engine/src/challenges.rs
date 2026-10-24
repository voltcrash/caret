//! Challenge requirement checks against a completed result. Catalog data and
//! setup stay with hosts; these rules decide pass/fail and the reasons shown.
use crate::js_round;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use ts_rs::TS;

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ChallengeResult {
    pub wpm: f64,
    pub acc: f64,
    pub raw_wpm: f64,
    pub consistency: f64,
    pub afk_duration: f64,
    pub test_duration: f64,
    pub funbox: Vec<String>,
}

/// JavaScript Number#toString for the finite magnitudes requirements use.
fn js_number(value: f64) -> String {
    if value.fract() == 0.0 && value.abs() < 1e21 {
        // adding zero turns -0 into 0, which JavaScript prints without a sign
        format!("{:.0}", value + 0.0)
    } else {
        value.to_string()
    }
}
/// JavaScript template-literal rendering of a JSON value.
fn display(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        Value::Number(number) => number
            .as_f64()
            .map_or_else(|| number.to_string(), js_number),
        Value::Array(items) => items.iter().map(display).collect::<Vec<_>>().join(","),
        Value::Object(_) => "[object Object]".into(),
        other => other.to_string(),
    }
}
fn number(value: &Value, key: &str) -> Option<f64> {
    value.get(key).and_then(Value::as_f64)
}
/// JavaScript truthiness of an optional numeric field.
fn truthy(value: &Value, key: &str) -> Option<f64> {
    number(value, key).filter(|&n| n != 0.0)
}
/// JavaScript `===` for JSON primitives; containers never compare equal.
fn strict_eq(a: Option<&Value>, b: &Value) -> bool {
    match (a, b) {
        (Some(Value::Number(a)), Value::Number(b)) => a.as_f64() == b.as_f64(),
        (Some(Value::Object(_) | Value::Array(_)), _) | (_, Value::Object(_) | Value::Array(_)) => {
            false
        }
        (Some(a), b) => a == b,
        (None, _) => false,
    }
}

fn check(
    result: &ChallengeResult,
    config: &Map<String, Value>,
    kind: &str,
    requirement: &Value,
    reasons: &mut Vec<String>,
) -> Result<(), String> {
    let afk = (result.afk_duration / result.test_duration) * 100.0;
    let has = |key: &str| requirement.get(key).is_some();
    match kind {
        "wpm" | "acc" => {
            let (value, label) = if kind == "wpm" {
                (js_round(result.wpm), "WPM")
            } else {
                (result.acc, "Accuracy")
            };
            if has("exact") {
                let exact = number(requirement, "exact").unwrap_or(f64::NAN);
                if value != exact {
                    reasons.push(format!("{label} not {}", display(&requirement["exact"])));
                }
            } else if has("min") {
                let min = number(requirement, "min").unwrap_or(f64::NAN);
                let actual = if kind == "wpm" {
                    result.wpm
                } else {
                    result.acc
                };
                if actual < min {
                    reasons.push(format!("{label} below {}", js_number(min)));
                }
            }
        }
        "afk" => {
            if let Some(max) = truthy(requirement, "max")
                && js_round(afk) > max
            {
                reasons.push(format!("AFK percentage above {}", js_number(max)));
            }
        }
        "time" => {
            if let Some(min) = truthy(requirement, "min")
                && js_round(result.test_duration) < min
            {
                reasons.push(format!("Test time below {}", js_number(min)));
            }
        }
        "funbox" => {
            let required: Vec<String> = requirement
                .get("exact")
                .cloned()
                .map(serde_json::from_value)
                .transpose()
                .map_err(|error| error.to_string())?
                .ok_or("Funbox mode is undefined")?;
            if required.len() != result.funbox.len()
                || required.iter().any(|name| !result.funbox.contains(name))
            {
                for name in &required {
                    if !result.funbox.contains(name) {
                        reasons.push(format!("{name} funbox not active"));
                    }
                }
                for name in &result.funbox {
                    if !required.contains(name) {
                        reasons.push(format!("{name} funbox active"));
                    }
                }
            }
        }
        "raw" | "con" => {
            let (value, label) = if kind == "raw" {
                (result.raw_wpm, "Raw WPM")
            } else {
                (result.consistency, "Consistency")
            };
            if let Some(exact) = truthy(requirement, "exact")
                && js_round(value) != exact
            {
                reasons.push(format!("{label} not {}", js_number(exact)));
            }
        }
        "config" => {
            for (key, expected) in requirement.as_object().into_iter().flatten() {
                if !strict_eq(config.get(key), expected) {
                    reasons.push(format!("{key} not set to {}", display(expected)));
                }
            }
        }
        _ => {}
    }
    Ok(())
}

/// Reasons a result fails a challenge, in requirement order; empty when it passes.
pub fn verify(
    result: &ChallengeResult,
    config: &Map<String, Value>,
    requirements: Option<&Map<String, Value>>,
) -> Result<Vec<String>, String> {
    if (result.afk_duration / result.test_duration) * 100.0 > 10.0 {
        return Ok(vec!["AFK time is greater than 10%".into()]);
    }
    let mut reasons = vec![];
    for (kind, requirement) in requirements.into_iter().flatten() {
        if requirement.is_null() {
            return Err("Requirement value is undefined".into());
        }
        check(result, config, kind, requirement, &mut reasons)?;
    }
    Ok(reasons)
}
