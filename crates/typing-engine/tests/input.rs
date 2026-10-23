use serde_json::Value;
#[test]
fn language_equivalence_strips_only_the_legacy_size_suffix() {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/typing-fixtures/oracle/normalization.json");
    let cases: Vec<Value> = serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();
    for case in cases {
        let data: typing_engine::Text = serde_json::from_value(case["data"].clone()).unwrap();
        let target: typing_engine::Text = serde_json::from_value(case["target"].clone()).unwrap();
        assert_eq!(
            serde_json::json!([typing_engine::text::normalize(
                data.0[0],
                target.0.first().copied(),
                case["language"].as_str().unwrap()
            )]),
            case["expected"],
            "{case}"
        );
    }
}
#[test]
fn input_decisions_match_frozen_typescript_matrix() {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/typing-fixtures/oracle/input-rules.json");
    let reference: Value = serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();
    for (index, case) in reference["cases"].as_array().unwrap().iter().enumerate() {
        let mut config = reference["defaults"].as_object().unwrap().clone();
        config.extend(case["config"].as_object().unwrap().clone());
        let config = serde_json::from_value(Value::Object(config)).unwrap();
        let input = serde_json::from_value(case["input"].clone()).unwrap();
        let decision = typing_engine::input::evaluate(&config, &input);
        assert_eq!(
            serde_json::to_value(decision).unwrap(),
            case["decision"],
            "decision case {index}"
        );
        assert_eq!(
            typing_engine::input::blocked(
                &config,
                &input,
                case["input"]["hasNewline"].as_bool().unwrap()
            ),
            case["blocked"].as_bool().unwrap(),
            "blocked case {index}"
        );
        let state = &case["state"];
        let input = serde_json::from_value(state["inputValue"].clone()).unwrap();
        assert_eq!(
            typing_engine::input::can_delete(
                &config,
                &input,
                state["wordIndex"].as_u64().unwrap() as usize,
                state["previousWordCorrect"].as_bool().unwrap(),
                state["previousWordAvailable"].as_bool().unwrap()
            ),
            case["canDelete"].as_bool().unwrap(),
            "deletion case {index}"
        );
    }
}

#[test]
fn layout_preflight_controls_wrapping_without_host_rule_decisions() {
    use typing_engine::{Command, Config, Session, Text, session::InsertionLayout};
    let mut session = Session::new(
        Config {
            mode: "words".into(),
            words: 0,
            ..Config::default()
        },
        vec![Text::from("a ")],
    )
    .unwrap();
    session
        .apply(
            serde_json::from_value(serde_json::json!({"op":"insert","data":[120],"now":0}))
                .unwrap(),
        )
        .unwrap();
    let layout = InsertionLayout {
        wrapped: true,
        ..InsertionLayout::default()
    };
    let check = session.preflight(Text::from("x"), &layout);
    assert!(check.measure_overflow && check.blocked);
    let log = session.log();
    session
        .apply(
            serde_json::from_value(
                serde_json::json!({"op":"insert","data":[120],"now":1,"layout":{"wrapped":true}}),
            )
            .unwrap(),
        )
        .unwrap();
    assert_eq!(log, session.log());
    let mut config = Config {
        mode: "words".into(),
        words: 0,
        blind_mode: true,
        ..Config::default()
    };
    session
        .apply(Command::Configure {
            now: 2.0,
            config: Box::new(config.clone()),
        })
        .unwrap();
    assert!(!session.preflight(Text::from("x"), &layout).blocked);
    config.blind_mode = false;
    config.hide_extra_letters = true;
    session
        .apply(Command::Configure {
            now: 3.0,
            config: Box::new(config),
        })
        .unwrap();
    assert!(!session.preflight(Text::from("x"), &layout).measure_overflow);
}
#[test]
fn explicit_batch_checkpoint_and_typography_expansion_preserve_full_commit() {
    use typing_engine::{Config, Session, Text};
    let config = Config {
        mode: "words".into(),
        words: 2,
        difficulty: "master".into(),
        ..Config::default()
    };
    let mut session =
        Session::new(config.clone(), vec![Text::from("a "), Text::from("b")]).unwrap();
    session.apply(serde_json::from_value(serde_json::json!({"op":"insert","data":[120],"now":0,"layout":{"finalInBatch":false}})).unwrap()).unwrap();
    assert!(!session.state().ended);
    session.apply(serde_json::from_value(serde_json::json!({"op":"insert","data":[121],"now":1,"layout":{"finalInBatch":true}})).unwrap()).unwrap();
    assert!(session.state().ended);
    let mut session = Session::new(config, vec![Text::from("a "), Text::from("b")]).unwrap();
    session
        .apply(
            serde_json::from_value(serde_json::json!({"op":"insert","data":[8230],"now":0}))
                .unwrap(),
        )
        .unwrap();
    assert!(session.state().ended);
    assert_eq!(session.state().input_value, Text::from("..."));
}
