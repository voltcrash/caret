use clap::Parser;
use oxytype_tui::{
    content::OfflineContent,
    engine::EngineHost,
    options::{Cli, FUNBOXES, custom_text},
};
use typing_engine::{Command, Config};

#[test]
fn bundled_modes_run_without_files_or_network() {
    for mode in ["words", "time", "quote", "custom", "zen"] {
        let content = OfflineContent::bundled().unwrap();
        assert_eq!(content.language.words.len(), 200);
        let custom = (mode == "custom")
            .then(|| custom_text("one two three", "repeat", "section", 1.0).unwrap());
        let mut host = EngineHost::offline(
            Config {
                mode: mode.into(),
                words: 3,
                time: 1.0,
                ..Default::default()
            },
            content,
            custom,
            42,
        )
        .unwrap();
        if mode == "zen" {
            host.insert("hello ", 100.0, 1000.0).unwrap();
            host.command(Command::Bailout {
                now: 1100.0,
                date: 2000.0,
            })
            .unwrap();
        } else if mode == "time" {
            let word = host.words[0].display_lossy();
            host.insert(&word, 100.0, 1000.0).unwrap();
            host.command(Command::Advance {
                now: 1200.0,
                date: 2100.0,
            })
            .unwrap();
        } else {
            for index in 0..100 {
                if host.state().ended {
                    break;
                }
                let word = host.words[index].display_lossy();
                host.insert(
                    &word,
                    100.0 + index as f64 * 1000.0,
                    1000.0 + index as f64 * 1000.0,
                )
                .unwrap();
            }
        }
        assert!(host.state().ended, "{mode}");
        assert!(host.result.is_some(), "{mode}: {:?}", host.result_error);
        let log = host.log().unwrap();
        assert!(
            log.events
                .iter()
                .all(|e| !["keydown", "keyup"].contains(&e.kind.as_str()))
        );
        assert_eq!(
            serde_json::to_value(host.result.unwrap()).unwrap(),
            serde_json::to_value(typing_engine::stats::typed_summary(&log).unwrap()).unwrap()
        );
    }
}
#[test]
fn all_bundled_quote_groups_and_advertised_transforms_prepare() {
    for group in 0..=3 {
        let host = EngineHost::offline(
            Config {
                mode: "quote".into(),
                quote_length: vec![group],
                ..Default::default()
            },
            OfflineContent::bundled().unwrap(),
            None,
            42,
        )
        .unwrap();
        assert!(!host.words.is_empty());
    }
    for name in FUNBOXES {
        let host = EngineHost::offline(
            Config {
                mode: "words".into(),
                words: 5,
                funbox: vec![(*name).into()],
                ..Default::default()
            },
            OfflineContent::bundled().unwrap(),
            None,
            42,
        )
        .unwrap();
        assert_eq!(host.words.len(), 5, "{name}");
    }
}
#[test]
fn cli_uses_core_defaults_and_rejects_unavailable_features() {
    let (config, _, _) = Cli::parse_from(["oxytype"])
        .prepare(Config::default())
        .unwrap();
    assert_eq!(
        serde_json::to_value(config).unwrap(),
        serde_json::to_value(Config::default()).unwrap()
    );
    for args in [
        vec!["oxytype", "--language", "missing"],
        vec!["oxytype", "--mode", "custom"],
        vec!["oxytype", "--funbox", "tts"],
        vec!["oxytype", "--time", "NaN"],
        vec!["oxytype", "--quote-length", "-2"],
    ] {
        let parsed = Cli::try_parse_from(args);
        assert!(parsed.is_err() || parsed.unwrap().prepare(Config::default()).is_err());
    }
    let (config, _, custom) = Cli::parse_from([
        "oxytype",
        "--text",
        "one two",
        "--custom-order",
        "shuffle",
        "--custom-limit",
        "word",
        "--custom-length",
        "7",
    ])
    .prepare(Config::default())
    .unwrap();
    assert_eq!(config.mode, "custom");
    assert_eq!(custom.unwrap().limit.value, 7.0);
}
#[test]
fn local_pack_validation_is_lossless_utf16_and_bounded() {
    let pack = serde_json::json!({"formatVersion":1,"license":"CC0-1.0","attribution":"Test","language":{"name":"test","words":["e\u{301}","界","😀"]},"quotes":[{"id":1,"text":"😀 界","source":"Test"}]});
    let content = OfflineContent::parse(&pack.to_string()).unwrap();
    assert_eq!(content.language.words[2].0, vec![0xd83d, 0xde00]);
    for patch in [
        serde_json::json!({"formatVersion":2}),
        serde_json::json!({"language":{"name":"test","words":["\u{1b}[31m"]}}),
        serde_json::json!({"license":""}),
        serde_json::json!({"quotes":[{"id":1,"text":"a","source":"x"},{"id":1,"text":"b","source":"x"}]}),
    ] {
        let mut bad = pack.clone();
        for (key, value) in patch.as_object().unwrap() {
            bad[key] = value.clone();
        }
        assert!(OfflineContent::parse(&bad.to_string()).is_err());
    }
    assert!(OfflineContent::parse(&" ".repeat(8 * 1024 * 1024 + 1)).is_err());
}

#[test]
fn custom_crlf_newline_tab_and_non_bmp_text_remain_typable() {
    let custom =
        oxytype_tui::options::custom_text_auto("one\r\n\t界😀", "repeat", "word", None).unwrap();
    let mut host = EngineHost::offline(
        Config {
            mode: "custom".into(),
            ..Default::default()
        },
        OfflineContent::bundled().unwrap(),
        Some(custom),
        42,
    )
    .unwrap();
    assert_eq!(host.words[0], typing_engine::Text::from("one\n"));
    host.insert("one", 100.0, 1000.0).unwrap();
    host.insert("\n", 1100.0, 2000.0).unwrap();
    assert_eq!(host.state().word_index, 1);
    host.insert("\t界😀", 2100.0, 3000.0).unwrap();
    assert!(host.state().ended);
    assert_eq!(host.result.unwrap().acc, 100.0);
}

#[test]
fn default_custom_uses_the_whole_passage_and_explicit_zero_stays_infinite() {
    let (config, content, custom) = Cli::parse_from(["oxytype", "--text", "one two three"])
        .prepare(Config::default())
        .unwrap();
    assert_eq!(custom.as_ref().unwrap().limit.value, 3.0);
    assert_eq!(
        EngineHost::offline(config, content, custom, 42)
            .unwrap()
            .words
            .len(),
        3
    );
    let (_, _, custom) = Cli::parse_from(["oxytype", "--text", "one two", "--custom-length", "0"])
        .prepare(Config::default())
        .unwrap();
    assert_eq!(custom.unwrap().limit.value, 0.0);
}

#[test]
fn plain_text_separators_and_bom_do_not_truncate_non_bmp_units() {
    let custom = oxytype_tui::options::custom_text_auto(
        "\u{feff}one\u{a0}two\u{200b}\u{12000}",
        "repeat",
        "word",
        None,
    )
    .unwrap();
    assert_eq!(custom.text.len(), 3);
    assert_eq!(custom.text[2], typing_engine::Text::from("\u{12000}"));
    let mut host = EngineHost::offline(
        Config {
            mode: "custom".into(),
            ..Default::default()
        },
        OfflineContent::bundled().unwrap(),
        Some(custom),
        42,
    )
    .unwrap();
    for (i, text) in ["one ", "two ", "\u{12000}"].iter().enumerate() {
        host.insert(text, 100.0 + i as f64 * 1000.0, 1000.0 + i as f64 * 1000.0)
            .unwrap();
    }
    assert!(host.state().ended);
    assert_eq!(host.result.unwrap().acc, 100.0);
}
