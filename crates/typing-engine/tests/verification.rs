use serde_json::{Value, json};
use typing_engine::{BEHAVIOR_VERSION, Text, stats::Log, verification::verify};

/// Unchanged browser recordings with the completed events they produced.
fn recordings() -> Vec<(String, Log, Value)> {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/typing-fixtures/reference/keystrokes");
    let mut recordings = vec![];
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
        recordings.push((
            path.file_stem().unwrap().to_string_lossy().into(),
            serde_json::from_value(log).unwrap(),
            fixture["completedEvent"].clone(),
        ));
    }
    assert!(recordings.len() >= 8);
    recordings
}
fn fields(log: &Log, submitted: &Value) -> Vec<String> {
    verify(log, submitted, BEHAVIOR_VERSION)
        .unwrap()
        .mismatches
        .into_iter()
        .map(|m| m.field)
        .collect()
}

#[test]
fn honest_browser_results_replay_exactly() {
    for (name, log, completed) in recordings() {
        assert_eq!(fields(&log, &completed), Vec::<String>::new(), "{name}");
    }
}

#[test]
fn seeded_untrusted_audit_mutations_never_panic_or_poison_the_next_replay() {
    let (_, log, completed) = recordings().remove(0);
    let original = serde_json::to_value(&log).unwrap();
    let mut random = 7_u32;
    for seed in 0..512 {
        random = random.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
        let mut mutated = original.clone();
        let events = mutated["events"].as_array_mut().unwrap();
        let index = random as usize % events.len();
        let value = [
            json!(-1),
            json!(u64::MAX),
            json!(null),
            json!("invalid"),
            json!([]),
        ][seed % 5]
            .clone();
        match seed % 4 {
            0 => events[index]["timestamp"] = value,
            1 => events[index]["data"]["wordIndex"] = value,
            2 => events[index]["data"]["charIndex"] = value,
            _ => events[index]["type"] = value,
        }
        let query = json!({"op":"verify","log":mutated,"result":completed,"behaviorVersion":BEHAVIOR_VERSION});
        let outcome = std::panic::catch_unwind(|| {
            if let Ok(query) = serde_json::from_value::<typing_engine::audit::Query>(query) {
                let _ = typing_engine::audit::audit(query);
            }
        });
        assert!(outcome.is_ok(), "audit mutation seed {seed}");
    }
    assert!(fields(&log, &completed).is_empty());
}

#[test]
fn edited_metrics_are_reported_by_field() {
    for (name, log, completed) in recordings() {
        let mut edited = completed.clone();
        edited["wpm"] = json!(completed["wpm"].as_f64().unwrap() + 20.0);
        // far below display precision, still beyond replay tolerance
        edited["acc"] = json!(completed["acc"].as_f64().unwrap() - 1e-6);
        edited["mode2"] = json!("not-a-mode");
        assert_eq!(fields(&log, &edited), ["wpm", "acc", "mode2"], "{name}");
    }
}

#[test]
fn edited_key_timings_are_caught() {
    let (_, log, completed) = recordings()
        .into_iter()
        .find(|(name, ..)| name == "time-15")
        .unwrap();
    let mut edited = completed.clone();
    let spacing = edited["keySpacing"].as_array_mut().unwrap();
    spacing[3] = json!(spacing[3].as_f64().unwrap() + 0.5);
    assert_eq!(fields(&log, &edited), ["keySpacing"]);
    let mut dropped = completed.clone();
    dropped["keyDuration"].as_array_mut().unwrap().pop();
    assert_eq!(fields(&log, &dropped), ["keyDuration"]);
}

#[test]
fn long_test_sentinels_skip_only_their_arrays() {
    let (_, log, completed) = recordings()
        .into_iter()
        .find(|(name, ..)| name == "time-15")
        .unwrap();
    let mut long = completed.clone();
    for field in ["chartData", "keySpacing", "keyDuration"] {
        long[field] = json!("toolong");
    }
    assert!(fields(&log, &long).is_empty());
    long["consistency"] = json!(0);
    assert_eq!(fields(&log, &long), ["consistency"]);
}

#[test]
fn invalid_logs_fail_validation() {
    let (_, mut log, completed) = recordings().into_iter().next().unwrap();
    log.version = 0;
    assert!(verify(&log, &completed, BEHAVIOR_VERSION).is_err());
}

#[test]
fn other_scoring_rules_are_not_compared() {
    let (_, log, mut completed) = recordings().into_iter().next().unwrap();
    completed["wpm"] = json!(999);
    let verdict = verify(&log, &completed, BEHAVIOR_VERSION + 1).unwrap();
    assert!(!verdict.same_behavior);
    assert!(verdict.mismatches.is_empty());
    assert!(
        verify(&log, &completed, BEHAVIOR_VERSION)
            .unwrap()
            .same_behavior
    );
}

#[test]
fn oversized_duration_logs_are_rejected_and_duration_mismatch_short_circuits() {
    let (_, mut oversized, completed) = recordings()
        .into_iter()
        .find(|(name, ..)| name == "time-15")
        .unwrap();
    if let Some(end) = oversized
        .events
        .iter_mut()
        .rev()
        .find(|e| e.kind == "timer" && e.data["event"] == "end")
    {
        end.test_ms = typing_engine::validation::MAX_HISTORY_MS + 1000.0;
    }
    assert!(verify(&oversized, &completed, BEHAVIOR_VERSION).is_err());

    let (_, mut long_log, mut mismatched) = recordings()
        .into_iter()
        .find(|(name, ..)| name == "time-15")
        .unwrap();
    if let Some(end) = long_log
        .events
        .iter_mut()
        .rev()
        .find(|e| e.kind == "timer" && e.data["event"] == "end")
    {
        end.test_ms = typing_engine::validation::MAX_HISTORY_MS;
    }
    mismatched["testDuration"] = json!(15.0);
    assert_eq!(fields(&long_log, &mismatched), ["testDuration"]);
}

#[test]
fn linear_speed_history_matches_per_boundary_chars_and_handles_large_logs() {
    for (name, log, _) in recordings() {
        for raw in [false, true] {
            let expected: Vec<f64> = typing_engine::stats::boundaries(&log)
                .iter()
                .map(|boundary| {
                    let c = typing_engine::stats::chars(&log, true, Some(*boundary));
                    typing_engine::js_round(typing_engine::stats::wpm(
                        if raw {
                            c.all_correct + c.incorrect + c.extra
                        } else {
                            c.correct_word
                        },
                        boundary / 1000.0,
                    ))
                })
                .collect();
            assert_eq!(
                typing_engine::stats::speed_history(&log, raw),
                expected,
                "{name} raw={raw}"
            );
        }
    }

    // Large log with 2,000 words and 10,000s span must complete quickly.
    let target_words: Vec<Text> = (0..2000).map(|_| Text::from("test ")).collect();
    let mut events = vec![
        serde_json::from_value(json!({
            "type": "timer",
            "testMs": 0.0,
            "data": {"event": "start", "timer": 0, "date": 1000.0}
        }))
        .unwrap(),
    ];
    for i in 0..2000 {
        events.push(
            serde_json::from_value(json!({
                "type": "input",
                "testMs": (i as f64 + 1.0) * 1000.0,
                "data": {
                    "inputType": "insertText",
                    "wordIndex": i,
                    "charIndex": 0,
                    "inputValue": Text::from("test "),
                    "data": Text::from(" "),
                    "correct": true,
                    "commitsWord": true
                }
            }))
            .unwrap(),
        );
    }
    events.push(
        serde_json::from_value(json!({
            "type": "timer",
            "testMs": 10_000_000.0,
            "data": {"event": "end", "timer": 10000, "date": 10_001_000.0}
        }))
        .unwrap(),
    );
    let large = Log {
        version: 1,
        context: typing_engine::stats::Context {
            target_words,
            mode: "words".into(),
            mode2: "2000".into(),
            bailed_out: false,
            korean_status: false,
            custom_text_limit_mode: None,
            custom_text_limit_value: None,
        },
        events,
    };
    let start = std::time::Instant::now();
    let speed = typing_engine::stats::speed_history(&large, false);
    assert_eq!(speed.len(), 10_000);
    assert!(
        start.elapsed().as_secs() < 2,
        "speed_history took {:?}",
        start.elapsed()
    );
}

#[test]
fn v2_logs_bind_result_modifiers_and_require_them() {
    let (_, log, completed) = recordings()
        .into_iter()
        .find(|(name, ..)| name == "time-15")
        .unwrap();

    // v2 log missing modifier fields fails validation.
    let mut raw = serde_json::to_value(&log).unwrap();
    raw["version"] = json!(typing_engine::EVENT_LOG_VERSION);
    assert!(typing_engine::verification::verify_value(&raw, &completed, BEHAVIOR_VERSION).is_err());

    // Populate modifier context matching completed event -> verified.
    raw["context"]["punctuation"] = json!(false);
    raw["context"]["numbers"] = json!(false);
    raw["context"]["funbox"] = json!([]);
    raw["context"]["difficulty"] = json!("normal");
    raw["context"]["language"] = json!("english");
    raw["context"]["stopOnLetter"] = json!(false);
    let verified =
        typing_engine::verification::verify_value(&raw, &completed, BEHAVIOR_VERSION).unwrap();
    assert!(verified.mismatches.is_empty());

    // Forging XP/difficulty/language/stopOnLetter modifiers is caught.
    let mut forged = completed.clone();
    forged["punctuation"] = json!(true);
    forged["numbers"] = json!(true);
    forged["funbox"] = json!(["gibberish"]);
    forged["difficulty"] = json!("master");
    forged["language"] = json!("english_10k");
    forged["stopOnLetter"] = json!(true);
    let mismatched: Vec<String> =
        typing_engine::verification::verify_value(&raw, &forged, BEHAVIOR_VERSION)
            .unwrap()
            .mismatches
            .into_iter()
            .map(|m| m.field)
            .collect();
    assert_eq!(
        mismatched,
        [
            "punctuation",
            "numbers",
            "stopOnLetter",
            "difficulty",
            "language",
            "funbox",
        ]
    );

    // Session::log emits v2 with modifier context populated.
    let session = typing_engine::Session::new(
        typing_engine::Config {
            punctuation: true,
            numbers: true,
            difficulty: "expert".into(),
            language: "english_1k".into(),
            stop_on_error: "letter".into(),
            ..typing_engine::Config::default()
        },
        vec![Text::from("hello")],
    )
    .unwrap();
    let emitted = session.log();
    assert_eq!(emitted["version"], typing_engine::EVENT_LOG_VERSION);
    assert_eq!(emitted["context"]["punctuation"], true);
    assert_eq!(emitted["context"]["numbers"], true);
    assert_eq!(emitted["context"]["difficulty"], "expert");
    assert_eq!(emitted["context"]["language"], "english_1k");
    assert_eq!(emitted["context"]["stopOnLetter"], true);
}

#[test]
fn v2_logs_verify_language_names_with_punctuation_such_as_code_cpp() {
    let (_, log, mut completed) = recordings()
        .into_iter()
        .find(|(name, ..)| name == "time-15")
        .unwrap();
    let mut raw = serde_json::to_value(&log).unwrap();
    raw["version"] = json!(typing_engine::EVENT_LOG_VERSION);
    raw["context"]["punctuation"] = json!(false);
    raw["context"]["numbers"] = json!(false);
    raw["context"]["funbox"] = json!([]);
    raw["context"]["difficulty"] = json!("normal");
    raw["context"]["language"] = json!("code_c++");
    raw["context"]["stopOnLetter"] = json!(false);
    completed["language"] = json!("code_c++");

    let verdict =
        typing_engine::verification::verify_value(&raw, &completed, BEHAVIOR_VERSION).unwrap();
    assert!(verdict.mismatches.is_empty());

    let mut forged = completed.clone();
    forged["language"] = json!("code_c");
    let mismatched: Vec<String> =
        typing_engine::verification::verify_value(&raw, &forged, BEHAVIOR_VERSION)
            .unwrap()
            .mismatches
            .into_iter()
            .map(|m| m.field)
            .collect();
    assert_eq!(mismatched, ["language"]);

    raw["context"]["language"] = json!("a".repeat(129));
    assert!(typing_engine::verification::verify_value(&raw, &completed, BEHAVIOR_VERSION).is_err());

    raw["context"]["language"] = json!("");
    assert!(typing_engine::verification::verify_value(&raw, &completed, BEHAVIOR_VERSION).is_err());
}
