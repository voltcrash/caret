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

#[test]
fn hangul_disassembly_matches_frozen_original_library_for_every_utf16_unit() {
    // Frozen from hangul-js 0.2.6, all 65536 individual UTF-16 code units.
    // FNV-1a64 over each result's unit length followed by its UTF-16 units.
    let mut hash = 14695981039346656037_u64;
    let mut count = 0;
    for unit in 0..=u16::MAX {
        let result = typing_engine::text::disassemble_hangul(&Text(vec![unit]));
        for unit in std::iter::once(result.len() as u16).chain(result.0) {
            hash = (hash ^ u64::from(unit)).wrapping_mul(1099511628211);
            count += 1;
        }
    }
    assert_eq!(count, 161148);
    assert_eq!(hash, 0x6b0ab93734a2fb3f);
}
