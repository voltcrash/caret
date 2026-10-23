use serde_json::{Value, json};
use typing_engine::{
    Text,
    stats::{self, Log},
};

fn equal(actual: &Value, expected: &Value, path: &str) {
    match (actual, expected) {
        (Value::Number(a), Value::Number(b)) => assert_eq!(a.as_f64(), b.as_f64(), "{path}"),
        (Value::Array(a), Value::Array(b)) => {
            assert_eq!(a.len(), b.len(), "{path}");
            for (index, (a, b)) in a.iter().zip(b).enumerate() {
                equal(a, b, &format!("{path}[{index}]"));
            }
        }
        (Value::Object(a), Value::Object(b)) => {
            assert_eq!(a.len(), b.len(), "{path}");
            for (key, value) in a {
                equal(value, &b[key], &format!("{path}.{key}"));
            }
        }
        _ => assert_eq!(actual, expected, "{path}"),
    }
}

#[test]
fn synthetic_legacy_analysis_calls_match_the_write_once_reference() {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/typing-fixtures/oracle/synthetic-analysis.json");
    let cases: Vec<Value> = serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();
    assert_eq!(cases.len(), 67);
    for (index, case) in cases.iter().enumerate() {
        let name = case["name"].as_str().unwrap();
        let args = &case["args"];
        let mut wire = args[0].clone();
        wire["context"]["targetWords"] = json!(
            wire["context"]["targetWords"]
                .as_array()
                .unwrap()
                .iter()
                .map(|word| Text::from(word.as_str().unwrap()))
                .collect::<Vec<_>>()
        );
        let log: Log = serde_json::from_value(wire).unwrap();
        let summary = stats::summary(&log);
        let strings = |words: Vec<Text>| {
            json!(
                words
                    .into_iter()
                    .map(|word| String::from_utf16(&word.0).unwrap())
                    .collect::<Vec<_>>()
            )
        };
        let actual = match name {
            "getChars" => json!(stats::chars(
                &log,
                args[1].as_bool().unwrap_or(false),
                args[2].as_f64()
            )),
            "getAccuracy" => json!(stats::accuracy_counts(&log, args[1].as_f64())),
            "getStartToFirstKeypressMs" => summary["startToFirstKey"].clone(),
            "getLastKeypressToEndMs" => summary["lastKeyToEnd"].clone(),
            "getTestDurationMs" => json!(stats::duration(&log)),
            "getAfkDuration" => json!(stats::afk(&log)),
            "getIncompleteTestSeconds" => json!(stats::incomplete_seconds(&log)),
            "getKeypressSpacing" => json!(stats::key_timing(&log).spacing),
            "getKeypressDurations" => json!(stats::key_timing(&log).durations),
            "getKeypressOverlap" => summary["keyOverlap"].clone(),
            "getKeypressesPerSecond" => json!(stats::keypresses_per_second(&log)),
            "getBurstHistory" => json!(stats::burst_history(&log)),
            "getErrorCountHistory" => summary["chartData"]["err"].clone(),
            "getWpmHistory" => json!(stats::speed_history(&log, false)),
            "getInputHistory" => strings(stats::input_history(&log)),
            "getCorrectedWordsHistory" => strings(stats::corrected_history(&log)),
            "getMissedWords" => json!(
                stats::missed_words(&log)
                    .into_iter()
                    .map(|(word, count)| (String::from_utf16(&word.0).unwrap(), count))
                    .collect::<std::collections::BTreeMap<_, _>>()
            ),
            _ => panic!("Unmapped captured operation: {name}"),
        };
        // Compare numeric JSON semantically, preserving exact f64 values.
        equal(&actual, &case["expected"], &format!("case {index}: {name}"));
    }
}
