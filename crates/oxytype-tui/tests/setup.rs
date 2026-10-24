use oxytype_tui::{content::OfflineContent, setup::Setup};
use typing_engine::Config;

#[test]
fn settings_edit_drafts_and_apply_the_same_native_configuration() {
    let content = OfflineContent::bundled().unwrap();
    let mut setup = Setup::new(Config::default(), None);
    let original = setup.build(&content, 42).unwrap();
    setup.adjust(1); // time -> words
    setup.select(1);
    setup.adjust(-1); // 50 -> 40
    let changed = setup.build(&content, 42).unwrap();
    assert_eq!(original.config.mode, "time");
    assert_eq!(changed.config.mode, "words");
    assert_eq!(changed.words.len(), 40);
    setup.config.mode = "custom".into();
    assert!(setup.build(&content, 42).is_err());
    setup.text = "one two".into();
    setup.cycle_order();
    setup.cycle_limit();
    assert_eq!(setup.limit, "time");
    setup.limit = "word".into();
    setup.length = Some(7.0);
    assert_eq!(setup.build(&content, 42).unwrap().words.len(), 7);
    setup.config.funbox = vec!["tts".into()];
    assert!(setup.build(&content, 42).is_err());
    assert_eq!(changed.words.len(), 40); // Failed draft never replaces running host.
}
