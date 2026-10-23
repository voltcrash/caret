use serde_json::json;
use typing_engine::{Config, Session, Text};
fn apply(session: &mut Session, value: serde_json::Value) -> typing_engine::session::Update {
    session
        .apply(serde_json::from_value(value).unwrap())
        .unwrap()
}
fn monitored(config: Config) -> Session {
    let mut session = Session::new(config, vec![Text::from("a ")]).unwrap();
    apply(
        &mut session,
        json!({"op":"view","now":0,"monitorRenderDrift":true}),
    );
    apply(&mut session, json!({"op":"start","now":0}));
    session
}
#[test]
fn web_slow_timer_thresholds_are_strict_and_failure_precedes_ticks() {
    for drift in [125.0, 126.0, 250.0, 251.0, 500.0, 501.0] {
        let mut session = monitored(Config::default());
        let update = apply(&mut session, json!({"op":"advance","now":1000.0+drift}));
        assert_eq!(update.drift, Some(drift));
        assert_eq!(update.state.ended, drift > 500.0);
        if drift <= 500.0 {
            assert_eq!(update.slow_timer, drift > 125.0);
        }
        let log = session.log();
        let events = log["events"].as_array().unwrap();
        let steps: Vec<_> = events
            .iter()
            .filter(|event| event["type"] == "timer" && event["data"]["event"] == "step")
            .collect();
        assert_eq!(steps.len(), usize::from(drift <= 500.0));
        if drift > 500.0 {
            assert_eq!(update.state.reason.as_deref(), Some("slow timer"));
        } else if drift > 125.0 {
            assert_eq!(steps[0]["data"]["slowTimer"], true);
        }
    }
}
#[test]
fn six_slow_callbacks_fail_and_reset_clears_counter() {
    let mut session = monitored(Config::default());
    for tick in 1..=6 {
        let update = apply(
            &mut session,
            json!({"op":"advance","now":f64::from(tick)*1000.0+251.0}),
        );
        assert_eq!(update.state.ended, tick == 6);
    }
    apply(&mut session, json!({"op":"reset","now":7000}));
    apply(&mut session, json!({"op":"start","now":7000}));
    assert!(
        !apply(&mut session, json!({"op":"advance","now":8251}))
            .state
            .ended
    );
}
#[test]
fn long_and_infinite_modes_keep_catchup_without_web_short_test_failure() {
    for config in [
        Config {
            time: 130.0,
            ..Config::default()
        },
        Config {
            time: 0.0,
            ..Config::default()
        },
        Config {
            mode: "words".into(),
            words: 250,
            ..Config::default()
        },
        Config {
            mode: "words".into(),
            words: 0,
            ..Config::default()
        },
    ] {
        let mut session = monitored(config);
        let update = apply(&mut session, json!({"op":"advance","now":6000}));
        assert!(!update.state.ended);
        assert!(!update.slow_timer);
    }
}
#[test]
fn engine_slow_render_state_skips_overflow_measurement_until_reset() {
    let mut session = monitored(Config {
        mode: "words".into(),
        words: 50,
        ..Config::default()
    });
    apply(&mut session, json!({"op":"insert","data":[120],"now":0}));
    let layout = typing_engine::session::InsertionLayout {
        wrapped: true,
        ..Default::default()
    };
    assert!(session.preflight(Text::from("x"), &layout).blocked);
    apply(&mut session, json!({"op":"advance","now":1126}));
    let check = session.preflight(Text::from("x"), &layout);
    assert!(!check.blocked);
    assert!(!check.measure_overflow);
}
