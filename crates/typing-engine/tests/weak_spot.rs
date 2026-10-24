use typing_engine::{Text, weak_spot::WeakSpot};
#[test]
fn learner_penalizes_errors_and_remains_isolated() {
    let candidates = vec![Text::from("a"), Text::from("x")];
    let mut learner = WeakSpot::default();
    learner.update(&Text::from("x"), false, Some(100.0));
    assert_eq!(learner.best(&candidates), Some(&candidates[1]));
    assert_eq!(WeakSpot::default().best(&candidates), Some(&candidates[0]));
}
#[test]
fn unknown_spacing_is_not_learned_as_measured_zero() {
    let candidates = vec![Text::from("a"), Text::from("x")];
    let mut learner = WeakSpot::default();
    learner.update(&Text::from("x"), false, None);
    assert_eq!(learner.best(&candidates), Some(&candidates[0]));
}
