use serde_json::{Value, json};
use typing_engine::{Text, replay, stats::Log};
fn equal(a: &Value, b: &Value, path: &str) {
    match (a, b) {
        (Value::Number(a), Value::Number(b)) => assert_eq!(a.as_f64(), b.as_f64(), "{path}"),
        (Value::Array(a), Value::Array(b)) => {
            assert_eq!(a.len(), b.len(), "{path}");
            for (i, (a, b)) in a.iter().zip(b).enumerate() {
                equal(a, b, &format!("{path}[{i}]"));
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
fn replay_seeking_practice_and_validity_match_frozen_typescript_oracle() {
    let root =
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../packages/typing-fixtures");
    let references: Vec<Value> =
        serde_json::from_slice(&std::fs::read(root.join("oracle/analysis.json")).unwrap()).unwrap();
    for reference in references {
        let name = reference["name"].as_str().unwrap();
        let fixture: Value = serde_json::from_slice(
            &std::fs::read(root.join(format!("reference/keystrokes/{name}.json"))).unwrap(),
        )
        .unwrap();
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
        for frame in reference["frames"].as_array().unwrap() {
            let actual = replay::frame(&log, frame["time"].as_f64().unwrap());
            equal(&json!(actual.inputs), &frame["inputs"], name);
            equal(&json!(actual.active_index), &frame["activeIndex"], name);
        }
        for expected in reference["replay"].as_array().unwrap() {
            let words = replay::words(&log, expected["zen"].as_bool().unwrap());
            let steps = replay::steps(&log, expected["zen"].as_bool().unwrap());
            equal(&json!(words), &expected["words"], name);
            equal(&json!(steps), &expected["steps"], name);
            let mut prompt = replay::prompt(&words, &steps);
            let mut cursor = replay::Cursor::default();
            let sounds: Vec<_> = steps
                .iter()
                .map(|step| replay::apply(&mut prompt, &mut cursor, step))
                .collect();
            equal(&json!(sounds), &expected["sounds"], name);
            equal(&json!(prompt), &expected["final"], name);
            equal(&json!(cursor), &expected["cursor"], name);
            for expected in expected["seeks"].as_array().unwrap() {
                let mut prompt = replay::prompt(&words, &steps);
                let target = serde_json::from_value(expected["target"].clone()).unwrap();
                let actual = replay::seek(&mut prompt, &steps, target);
                equal(&json!(actual.cursor), &expected["cursor"], name);
                equal(&json!(actual.next_index), &expected["nextIndex"], name);
                equal(&json!(prompt), &expected["words"], name);
            }
        }
        let words: Vec<_> = log
            .context
            .target_words
            .iter()
            .map(|word| {
                let mut word = word.clone();
                if matches!(word.0.last(), Some(32 | 10)) {
                    word.0.pop();
                }
                word
            })
            .collect();
        for expected in reference["practice"].as_array().unwrap() {
            let actual = typing_engine::practice::select(
                &log,
                &words,
                expected["missed"].as_str().unwrap(),
                expected["slow"].as_bool().unwrap(),
                0.0,
            );
            equal(&json!(actual.result), &expected["result"], name);
            equal(
                &json!(actual.notifications),
                &expected["notifications"],
                name,
            );
        }
        for expected in reference["validity"].as_array().unwrap() {
            let input = serde_json::from_value(expected["input"].clone()).unwrap();
            equal(
                &json!(typing_engine::results::invalid_reason(&log, &input)),
                &expected["reason"],
                name,
            );
        }
    }
}
