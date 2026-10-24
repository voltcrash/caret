use serde_json::json;
use typing_engine::{
    Config, Session, Text,
    restart::{self, RestartBlock, RestartOptions, RestartState},
};
#[test]
fn long_test_thresholds_match_frozen_typescript_at_every_boundary() {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/typing-fixtures/oracle/restart.json");
    let reference: serde_json::Value =
        serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();
    for case in reference["quick"].as_array().unwrap() {
        let config: Config = serde_json::from_value(case.clone()).unwrap();
        let limit = serde_json::from_value(case["limit"].clone()).unwrap();
        let policy = typing_engine::policy::evaluate(serde_json::from_value(json!({
            "op":"quickRestart", "config":case, "limit":case["limit"], "customIsLong":case["customIsLong"]
        })).unwrap()).unwrap();
        assert_eq!(
            serde_json::to_value(policy).unwrap()["result"],
            case["expected"]
        );
        assert_eq!(
            restart::can_quick_restart(
                &config,
                Some(&limit),
                case["customIsLong"].as_bool().unwrap()
            ),
            case["expected"].as_bool().unwrap(),
            "{case}"
        );
    }
    for case in reference["quotes"].as_array().unwrap() {
        let config: Config = serde_json::from_value(case.clone()).unwrap();
        let decision = restart::decide(
            &config,
            RestartState {
                active: true,
                failed: false,
                repeated: false,
                quote_language: Some("english"),
            },
            None,
            RestartOptions::default(),
        );
        assert_eq!(
            decision.with_same_wordset,
            case["expected"].as_bool().unwrap(),
            "{case}"
        );
    }
}
fn apply(session: &mut Session, value: serde_json::Value) {
    session
        .apply(serde_json::from_value(value).unwrap())
        .unwrap();
}
#[test]
fn no_quit_and_long_test_rejections_leave_active_sessions_unchanged() {
    let mut session = Session::new(
        Config {
            mode: "words".into(),
            words: 1000,
            funbox: vec!["no_quit".into()],
            ..Default::default()
        },
        vec![Text::from("a ")],
    )
    .unwrap();
    assert!(session.restart_policy(Default::default()).allowed);
    apply(&mut session, json!({"op":"insert","data":[97],"now":0}));
    let log = session.log();
    let blocked = session.restart_policy(RestartOptions {
        quick: true,
        ..Default::default()
    });
    assert_eq!(blocked.reason, Some(RestartBlock::NoQuit));
    assert!(blocked.prevent_default);
    assert!(!blocked.record_incomplete);
    apply(
        &mut session,
        json!({"op":"configure","now":0,"config":{"mode":"words","words":1000}}),
    );
    assert_eq!(
        session
            .restart_policy(RestartOptions {
                quick: true,
                ..Default::default()
            })
            .reason,
        Some(RestartBlock::LongTest)
    );
    let ordinary = session.restart_policy(Default::default());
    assert!(ordinary.allowed && ordinary.record_incomplete);
    assert!(!ordinary.prevent_default);
    assert_eq!(session.log(), log);
}
#[test]
fn quote_repetition_requires_matching_language_and_active_or_failed_state() {
    let config = Config {
        mode: "quote".into(),
        language: "english_1k".into(),
        repeat_quotes: "typing".into(),
        ..Default::default()
    };
    for (active, failed, language, expected) in [
        (true, false, "english", true),
        (false, true, "english", true),
        (false, false, "english", false),
        (true, false, "spanish", false),
    ] {
        let decision = restart::decide(
            &config,
            RestartState {
                active,
                failed,
                repeated: false,
                quote_language: Some(language),
            },
            None,
            Default::default(),
        );
        assert_eq!(decision.with_same_wordset, expected);
        assert_eq!(decision.repeat_with_pace, expected);
        assert_eq!(decision.record_incomplete, active);
    }
}
#[test]
fn active_repeated_tests_and_explicit_repeat_options_preserve_the_wordset() {
    for saving in [false, true] {
        let config = Config {
            result_saving: saving,
            repeated_pace: false,
            ..Default::default()
        };
        let decision = restart::decide(
            &config,
            RestartState {
                active: true,
                failed: false,
                repeated: true,
                quote_language: None,
            },
            None,
            Default::default(),
        );
        assert!(decision.with_same_wordset);
        assert_eq!(decision.record_incomplete, saving);
        assert!(!decision.repeat_with_pace);
        let mut zen = Session::new(
            Config {
                mode: "zen".into(),
                ..Default::default()
            },
            vec![],
        )
        .unwrap();
        apply(&mut zen, json!({"op":"insert","data":[97],"now":0}));
        let decision = zen.restart_policy(RestartOptions {
            quick: true,
            with_same_wordset: true,
            ..Default::default()
        });
        assert!(decision.allowed && decision.with_same_wordset && !decision.prevent_default);
    }
}
