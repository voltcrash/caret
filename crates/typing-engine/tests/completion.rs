use serde_json::json;
use typing_engine::{Config, Session, Text};
fn command(
    session: &mut Session,
    value: serde_json::Value,
) -> Result<typing_engine::session::Update, typing_engine::error::EngineError> {
    session.apply(serde_json::from_value(value).unwrap())
}
fn session() -> Session {
    let mut session = Session::new(
        Config {
            mode: "words".into(),
            words: 1,
            ..Config::default()
        },
        vec![Text::from("a")],
    )
    .unwrap();
    command(
        &mut session,
        json!({"op":"view","now":0,"deferFinish":true}),
    )
    .unwrap();
    session
}
#[test]
fn host_observes_completion_time_without_deciding_completion() {
    let mut session = session();
    let update = command(
        &mut session,
        json!({"op":"insert","data":[97],"now":1000,"date":1000000}),
    )
    .unwrap();
    assert!(update.finish.is_some());
    assert!(!update.state.ended);
    assert!(
        session
            .preflight(Text::from("x"), &Default::default())
            .blocked
    );
    let log = session.log();
    assert!(
        command(&mut session, json!({"op":"insert","data":[120],"now":1020}))
            .unwrap()
            .events
            .is_empty()
    );
    command(
        &mut session,
        json!({"op":"advance","now":5000,"date":1004000}),
    )
    .unwrap();
    assert_eq!(log, session.log());
    assert!(
        command(
            &mut session,
            json!({"op":"acknowledgeFinish","now":999,"date":1000000})
        )
        .is_err()
    );
    assert_eq!(log, session.log());
    let update = command(
        &mut session,
        json!({"op":"acknowledgeFinish","now":5050,"date":1004050}),
    )
    .unwrap();
    assert!(update.state.ended);
    assert!(update.finish.is_none());
    assert_eq!(
        session.log()["events"].as_array().unwrap().last().unwrap()["testMs"].as_f64(),
        Some(4050.0)
    );
    let log = session.log();
    assert!(
        command(
            &mut session,
            json!({"op":"acknowledgeFinish","now":5060,"date":1004060})
        )
        .is_err()
    );
    assert_eq!(log, session.log());
}
#[test]
fn reset_cancels_completion_acknowledgement_without_ending_a_new_test() {
    let mut session = session();
    command(&mut session, json!({"op":"insert","data":[97],"now":0})).unwrap();
    command(&mut session, json!({"op":"reset","now":1})).unwrap();
    assert!(command(&mut session, json!({"op":"acknowledgeFinish","now":2})).is_err());
    assert!(!session.state().ended);
    assert!(!session.state().active);
    assert!(session.log()["events"].as_array().unwrap().is_empty());
}
#[test]
fn failure_and_timer_completion_keep_their_engine_reason_until_acknowledged() {
    for timed in [false, true] {
        let mut session = Session::new(
            Config {
                mode: if timed { "time" } else { "words" }.into(),
                time: 1.0,
                words: 1,
                difficulty: "master".into(),
                ..Config::default()
            },
            vec![Text::from("a")],
        )
        .unwrap();
        command(
            &mut session,
            json!({"op":"view","now":0,"deferFinish":true}),
        )
        .unwrap();
        let update = command(
            &mut session,
            json!({"op":"insert","data":[if timed{97}else{120}],"now":0}),
        )
        .unwrap();
        let update = if timed {
            command(&mut session, json!({"op":"advance","now":1000})).unwrap()
        } else {
            update
        };
        assert_eq!(
            update.finish.unwrap().reason.as_deref(),
            if timed { None } else { Some("difficulty") }
        );
        let update = command(&mut session, json!({"op":"acknowledgeFinish","now":1100})).unwrap();
        assert!(update.state.ended);
        assert_eq!(
            update.state.reason.as_deref(),
            if timed { None } else { Some("difficulty") }
        );
    }
}

#[test]
fn completion_blocks_new_observations_but_preserves_outstanding_key_releases() {
    for deferred in [false, true] {
        let mut session = Session::new(
            Config {
                time: 15.0,
                ..Config::default()
            },
            vec![Text::from("abc")],
        )
        .unwrap();
        command(
            &mut session,
            json!({"op":"view","now":0,"deferFinish":deferred}),
        )
        .unwrap();
        command(&mut session, json!({"op":"insert","data":[97],"now":0})).unwrap();
        command(
            &mut session,
            json!({"op":"observe","eventType":"keydown","eventData":{"code":"KeyB"},"now":14990}),
        )
        .unwrap();
        // Leave another hold unreleased to exercise estimated cleanup.
        command(
            &mut session,
            json!({"op":"observe","eventType":"keydown","eventData":{"code":"KeyC"},"now":14995}),
        )
        .unwrap();
        command(&mut session, json!({"op":"advance","now":15010})).unwrap();
        // A duplicate must not synthesize a release or replace the held key.
        let ignored = command(
            &mut session,
            json!({"op":"observe","eventType":"keydown","eventData":{"code":"KeyB"},"now":15020}),
        )
        .unwrap();
        assert!(ignored.events.is_empty());
        let release = command(
            &mut session,
            json!({"op":"observe","eventType":"keyup","eventData":{"code":"KeyB"},"now":15030}),
        )
        .unwrap();
        assert_eq!(release.events.len(), 1);
        if deferred {
            command(&mut session, json!({"op":"acknowledgeFinish","now":15010})).unwrap();
        }
        command(&mut session, json!({"op":"finalize","now":15040})).unwrap();
        let finished = session.log();
        let log = serde_json::from_value(finished.clone()).unwrap();
        let summary = typing_engine::stats::typed_summary(&log).unwrap();
        assert_eq!(summary.key_duration, vec![40.0, 40.0]);
        for (kind, data) in [
            ("keydown", json!({"code":"KeyA"})),
            ("keyup", json!({"code":"KeyA"})),
            ("composition", json!({"event":"start"})),
        ] {
            let ignored = command(
                &mut session,
                json!({"op":"observe","eventType":kind,"eventData":data,"now":15182.7}),
            )
            .unwrap();
            assert!(ignored.events.is_empty());
            assert_eq!(session.log(), finished);
        }
    }
}
