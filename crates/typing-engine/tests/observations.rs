use serde_json::json;
use typing_engine::{Session, Text};
fn apply(session: &mut Session, value: serde_json::Value) -> typing_engine::session::Update {
    session
        .apply(serde_json::from_value(value).unwrap())
        .unwrap()
}
#[test]
fn visible_word_bound_blocks_backtracking_even_with_freedom() {
    let mut session = Session::new(
        serde_json::from_value(json!({"mode":"words","words":3,"freedomMode":true})).unwrap(),
        vec![Text::from("a "), Text::from("b "), Text::from("c")],
    )
    .unwrap();
    apply(&mut session, json!({"op":"insert","data":[97,32],"now":0}));
    apply(
        &mut session,
        json!({"op":"view","earliestVisibleWord":1,"now":10}),
    );
    apply(
        &mut session,
        json!({"op":"delete","kind":"deleteContentBackward","now":20}),
    );
    assert_eq!(session.state().word_index, 1);
    assert!(session.state().input_value.is_empty());
}
#[test]
fn deferred_indentation_retains_capture_time_and_reset_invalidates_old_tasks() {
    let mut session = Session::new(
        serde_json::from_value(json!({"mode":"words","words":2,"language":"code_javascript"}))
            .unwrap(),
        vec![Text::from("a\n"), Text::from("\t\tb")],
    )
    .unwrap();
    apply(
        &mut session,
        json!({"op":"view","deferAutomatic":true,"now":0}),
    );
    let update = apply(
        &mut session,
        json!({"op":"insert","data":[97,10],"now":100}),
    );
    assert!(update.automatic_pending);
    assert!(session.state().input_value.is_empty());
    let next = apply(
        &mut session,
        json!({"op":"flushAutomatic","generation":update.generation,"now":200}),
    );
    assert_eq!(session.state().input_value, Text::from("\t"));
    assert!(next.automatic_pending);
    assert!(next.events.iter().all(|event| event.test_ms == 0.0));
    apply(&mut session, json!({"op":"reset","now":250}));
    let stale = apply(
        &mut session,
        json!({"op":"flushAutomatic","generation":update.generation,"now":300}),
    );
    assert!(stale.events.is_empty());
    assert!(!stale.automatic_pending);
    assert!(!session.state().active);
}
#[test]
fn composition_defers_difficulty_until_the_committed_end() {
    let mut session = Session::new(
        serde_json::from_value(json!({"mode":"words","words":1,"difficulty":"master"})).unwrap(),
        vec![Text::from("abc")],
    )
    .unwrap();
    apply(
        &mut session,
        json!({"op":"observe","eventType":"composition","eventData":{"event":"start","wordIndex":99},"now":0}),
    );
    apply(&mut session, json!({"op":"insert","data":[120],"now":10}));
    assert!(!session.state().ended);
    apply(
        &mut session,
        json!({"op":"insert","data":[121],"isCompositionEnding":true,"now":20}),
    );
    assert!(session.state().ended);
    assert_eq!(session.state().reason.as_deref(), Some("difficulty"));
    assert_eq!(session.log()["events"][0]["data"]["wordIndex"], 0);
}

#[test]
fn browser_sentinel_regression_records_destination_and_clears_next_word() {
    let mut session = Session::new(
        serde_json::from_value(json!({"mode":"words","words":3})).unwrap(),
        vec![Text::from("one "), Text::from("two "), Text::from("three")],
    )
    .unwrap();
    apply(
        &mut session,
        json!({"op":"insert","data":[120,32,63],"now":0}),
    );
    let update = apply(
        &mut session,
        json!({"op":"delete","kind":"deleteWordBackward","observedInput":[],"sentinelRemoved":true,"now":20}),
    );
    assert_eq!(update.state.word_index, 0);
    assert!(update.state.input_value.is_empty());
    assert_eq!(
        update.events[0].data,
        json!({"inputType":"deleteWordBackward","wordIndex":0,"charIndex":0,"inputValue":[],"clearedNextWord":true})
    );
}

#[test]
fn unicode_deletion_observation_preserves_browser_grapheme_extent() {
    let mut session = Session::new(
        serde_json::from_value(json!({"mode":"words","words":1})).unwrap(),
        vec![Text::from("😀abc")],
    )
    .unwrap();
    apply(
        &mut session,
        json!({"op":"insert","data":[55357,56832],"now":0}),
    );
    let update = apply(
        &mut session,
        json!({"op":"delete","kind":"deleteContentBackward","observedInput":[],"now":20}),
    );
    assert!(update.state.input_value.is_empty());
    assert_eq!(update.events[0].data["charIndex"], 2);
    let before = session.log();
    assert!(session.apply(serde_json::from_value(json!({"op":"delete","kind":"deleteContentBackward","observedInput":[120],"now":30})).unwrap()).is_err());
    assert_eq!(session.log(), before);
}
