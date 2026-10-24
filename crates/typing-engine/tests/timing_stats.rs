use serde_json::{Value, json};
use typing_engine::{timing_review, timing_stats};

fn oracle() -> Value {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/typing-fixtures/oracle/timing-stats.json");
    serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap()
}
fn numbers(value: &Value) -> Vec<f64> {
    serde_json::from_value(value.clone()).unwrap()
}
/// Exact structure; floats within libm last-place differences from V8.
fn assert_close(actual: &Value, expected: &Value, path: &str) {
    match (actual, expected) {
        (Value::Number(a), Value::Number(e)) => {
            let (a, e) = (a.as_f64().unwrap(), e.as_f64().unwrap());
            assert!(
                (a - e).abs() <= 1e-9 * e.abs().max(1.0),
                "{path}: {a} != {e}"
            );
        }
        (Value::Object(a), Value::Object(e)) => {
            let mut keys: Vec<_> = a.keys().collect();
            let mut expected_keys: Vec<_> = e.keys().collect();
            keys.sort();
            expected_keys.sort();
            assert_eq!(keys, expected_keys, "{path}");
            for (key, value) in e {
                assert_close(&a[key], value, &format!("{path}.{key}"));
            }
        }
        (Value::Array(a), Value::Array(e)) => {
            assert_eq!(a.len(), e.len(), "{path}");
            for (index, (a, e)) in a.iter().zip(e).enumerate() {
                assert_close(a, e, &format!("{path}[{index}]"));
            }
        }
        _ => assert_eq!(actual, expected, "{path}"),
    }
}

#[test]
fn probit_matches_frozen_typescript() {
    for case in oracle()["probit"].as_array().unwrap() {
        let p = case["p"].as_f64().unwrap();
        assert_close(&json!(timing_stats::probit(p)), &case["expected"], "probit");
    }
}

#[test]
fn distributions_match_frozen_typescript() {
    for case in oracle()["distributions"].as_array().unwrap() {
        let name = case["name"].as_str().unwrap();
        let values = numbers(&case["values"]);
        assert_close(
            &json!(timing_stats::dist_stats(&values)),
            &case["stats"],
            name,
        );
        assert_close(
            &json!(timing_stats::bellness(&values, true)),
            &case["bellLogs"],
            name,
        );
        assert_close(
            &json!(timing_stats::bellness(&values, false)),
            &case["bellLinear"],
            name,
        );
    }
}

#[test]
fn cross_stats_and_review_match_frozen_typescript() {
    for case in oracle()["pairs"].as_array().unwrap() {
        let name = case["name"].as_str().unwrap();
        let spacing = numbers(&case["spacing"]);
        let duration = numbers(&case["duration"]);
        assert_close(
            &json!(timing_stats::cross_stats(&spacing, &duration)),
            &case["cross"],
            name,
        );
        assert_close(
            &json!(timing_review::review(&spacing, &duration)),
            &case["review"],
            name,
        );
    }
}
