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
