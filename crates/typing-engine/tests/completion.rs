use serde_json::json;
use typing_engine::{Config, Session, Text};
fn command(
    session: &mut Session,
    value: serde_json::Value,
) -> Result<typing_engine::session::Update, String> {
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
