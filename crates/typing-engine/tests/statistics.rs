use serde_json::{Value, json};
use typing_engine::{
    Text,
    stats::{Log, summary},
};

fn equal(a: &Value, b: &Value, path: &str) {
    match (a, b) {
        (Value::Number(a), Value::Number(b)) => assert_eq!(a.as_f64(), b.as_f64(), "{path}"),
        (Value::Array(a), Value::Array(b)) => {
            assert_eq!(a.len(), b.len(), "{path}");
            for (index, (a, b)) in a.iter().zip(b).enumerate() {
                equal(a, b, &format!("{path}[{index}]"));
            }
        }
        (Value::Object(a), Value::Object(b)) => {
            assert_eq!(a.len(), b.len(), "{path}");
            for (key, a) in a {
                equal(a, &b[key], &format!("{path}.{key}"));
            }
        }
        _ => assert_eq!(a, b, "{path}"),
    }
}

#[test]
fn summary_fields_match_all_unchanged_browser_results_exactly() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/typing-fixtures/reference/keystrokes");
    for file in std::fs::read_dir(root).unwrap() {
        let path = file.unwrap().path();
        if path.extension().is_none_or(|ext| ext != "json") {
            continue;
        }
        let fixture: Value = serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
        let mut log = fixture["eventLog"].clone();
        log["context"]["targetWords"] = json!(
            log["context"]["targetWords"]
                .as_array()
                .unwrap()
                .iter()
                .map(|word| Text::from(word.as_str().unwrap()))
                .collect::<Vec<_>>()
        );
        let log: Log = serde_json::from_value(log).unwrap();
        let actual = summary(&log);
        for (key, actual) in actual.as_object().unwrap() {
            equal(
                actual,
                &fixture["completedEvent"][key],
                &format!("{}.{key}", path.display()),
            );
        }
    }
}
