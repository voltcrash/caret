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
fn historical_surrogate_halves_keep_exact_stats_frames_playback_and_seeking() {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/typing-fixtures/oracle/historical-unicode.json");
    let references: Vec<Value> = serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();
    for reference in references {
        let name = reference["name"].as_str().unwrap();
        let log: Log = serde_json::from_value(reference["log"].clone()).unwrap();
        for (query, expected) in reference["queries"]
            .as_array()
            .unwrap()
            .iter()
            .zip(reference["expected"].as_array().unwrap())
        {
            let query = serde_json::from_value(query.clone()).unwrap();
            equal(
                &json!(typing_engine::analysis::analyze(&log, query)),
                expected,
                name,
            );
        }
        let stats = json!({
            "chars":typing_engine::stats::chars(&log,true,None),
            "acc":typing_engine::stats::accuracy(&log,None),
            "history":typing_engine::stats::input_history(&log),
            "corrected":typing_engine::stats::corrected_history(&log),
            "wpm":typing_engine::stats::speed_history(&log,false),
            "raw":typing_engine::stats::speed_history(&log,true),
            "burst":typing_engine::stats::word_burst_history(&log,1000.0)
        });
        equal(&stats, &reference["stats"], name);
        for expected in reference["playback"].as_array().unwrap() {
            let mut playback = replay::Playback::new(&log, expected["zen"].as_bool().unwrap());
            let mut sounds = vec![];
            while playback.snapshot().next_time.is_some() {
                sounds.push(playback.step().sound);
            }
            let snapshot = playback.snapshot();
            equal(&json!(snapshot.words), &expected["words"], name);
            equal(&json!(snapshot.cursor), &expected["cursor"], name);
            equal(&json!(sounds), &expected["sounds"], name);
            for target in expected["seeks"].as_array().unwrap() {
                let snapshot =
                    playback.seek(serde_json::from_value(target["target"].clone()).unwrap());
                equal(&json!(snapshot.words), &target["words"], name);
                equal(&json!(snapshot.cursor), &target["cursor"], name);
                equal(&json!(snapshot.next_index), &target["nextIndex"], name);
            }
        }
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
            let mut playback = replay::Playback::new(&log, expected["zen"].as_bool().unwrap());
            let mut rendered = playback.snapshot().words;
            let mut sounds = vec![];
            while playback.snapshot().next_time.is_some() {
                let update = playback.step();
                sounds.push(update.sound);
                assert!(update.words.len() <= 2);
                for change in update.words {
                    rendered[change.index] = change.word;
                }
            }
            equal(&json!(rendered), &expected["final"], name);
            equal(&json!(sounds), &expected["sounds"], name);
            equal(
                &json!(playback.snapshot().cursor),
                &expected["cursor"],
                name,
            );
            assert!(playback.step().words.is_empty());
            for expected in expected["seeks"].as_array().unwrap() {
                let mut prompt = replay::prompt(&words, &steps);
                let target = serde_json::from_value(expected["target"].clone()).unwrap();
                let actual = replay::seek(&mut prompt, &steps, target);
                equal(&json!(actual.cursor), &expected["cursor"], name);
                equal(&json!(actual.next_index), &expected["nextIndex"], name);
                equal(&json!(prompt), &expected["words"], name);
                let actual =
                    playback.seek(serde_json::from_value(expected["target"].clone()).unwrap());
                equal(&json!(actual.cursor), &expected["cursor"], name);
                equal(&json!(actual.next_index), &expected["nextIndex"], name);
                equal(&json!(actual.words), &expected["words"], name);
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
