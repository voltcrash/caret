use oxytype_tui::engine::EngineHost;
use typing_engine::{Config, Text, generation::Language};

#[test]
fn native_host_preserves_input_clocks_repeat_targets_and_missing_keyboard_data() {
    let mut host = EngineHost::new(
        Config {
            mode: "words".into(),
            words: 2,
            ..Default::default()
        },
        Language {
            name: "english".into(),
            words: ["a", "b", "c", "d"].into_iter().map(Text::from).collect(),
            ..Default::default()
        },
        None,
        42,
    )
    .unwrap();
    let original = host.words.clone();
    host.insert(&original[0].display_lossy(), 100.0, 10_100.0)
        .unwrap();
    assert_eq!(host.state().word_index, 1);
    assert_eq!(host.inputs[0], original[0]);
    host.insert(&original[1].display_lossy(), 1100.0, 11_100.0)
        .unwrap();
    assert!(host.state().ended);
    let result = host.result.as_ref().unwrap();
    assert_eq!(result.wpm, 36.0);
    assert_eq!(result.acc, 100.0);
    assert_eq!(result.test_duration, 1.0);
    assert!(result.key_duration.is_empty());
    assert!(
        host.log()
            .unwrap()
            .events
            .iter()
            .all(|event| event.kind != "keydown" && event.kind != "keyup")
    );
    host.restart(true, 1200.0, 11_200.0).unwrap();
    assert_eq!(host.words, original);
    assert_eq!(host.seed, 42);
    assert!(!host.state().active);
    assert!(!host.state().ended);
    assert!(host.inputs.is_empty());
}
