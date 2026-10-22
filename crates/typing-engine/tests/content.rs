use serde_json::Value;
use typing_engine::{
    Text,
    content::{Queue, Source},
};
#[test]
fn poetry_and_extracted_article_cleanup_match_unchanged_typescript() {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/typing-fixtures/oracle/content.json");
    let references: Vec<Value> = serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();
    for (index, reference) in references.into_iter().enumerate() {
        let source: Source = serde_json::from_value(reference["source"].clone()).unwrap();
        let section = source
            .normalize(reference["english"].as_bool().unwrap())
            .unwrap();
        assert_eq!(
            serde_json::to_value(section).unwrap(),
            reference["expected"],
            "content case {index}"
        );
    }
}
fn poem(word: &str) -> Source {
    Source::Poem {
        title: Text::from("Title"),
        author: Text::from("Author"),
        lines: vec![Text::from(word)],
    }
}
#[test]
fn section_requests_are_owned_bounded_and_cancelled_by_generation() {
    let mut queue = Queue::new("poetry".into(), "english".into(), true);
    let first = queue.request();
    assert_eq!(queue.request(), first);
    assert!(
        queue
            .supply(
                &first,
                Source::Article {
                    title: Text::default(),
                    author: None,
                    plain_text: Text::from("text")
                }
            )
            .is_err()
    );
    assert_eq!(queue.pending(), Some(&first));
    queue.reset(1);
    let second = queue.request();
    assert_ne!(first, second);
    assert!(queue.supply(&first, poem("stale")).is_err());
    let mut forged = second.clone();
    forged.language = "french".into();
    assert!(queue.supply(&forged, poem("forged")).is_err());
    queue.supply(&second, poem("fresh")).unwrap();
    assert!(queue.pending().is_none());
    assert_eq!(queue.pop().unwrap().words, vec![Text::from("fresh")]);
    for _ in 0..16 {
        queue.prefetch(poem("word")).unwrap();
    }
    assert!(queue.prefetch(poem("overflow")).is_err());
    for _ in 0..16 {
        assert_eq!(queue.pop().unwrap().words, vec![Text::from("word")]);
    }
    assert!(queue.is_empty());
}

fn section_generator(prefetch: Vec<Source>) -> typing_engine::generation::Generator {
    use typing_engine::{
        Config,
        generation::{Assets, Generator, Language},
        random::Random,
    };
    let config = Config {
        mode: "words".into(),
        words: 12,
        punctuation: true,
        funbox: vec!["poetry".into()],
        ..Config::default()
    };
    Generator::with_assets(
        config,
        Language {
            name: "english".into(),
            words: vec![Text::from("base")],
            ..Language::default()
        },
        None,
        Random::seeded(4),
        &mut Assets {
            sections: prefetch,
            ..Assets::default()
        },
    )
    .unwrap()
}
#[test]
fn deferred_initial_generation_resumes_without_repeating_words_or_random_draws() {
    let sources: Vec<_> = (0..4)
        .map(|index| poem(&format!("Section{index} café Three Four")))
        .collect();
    let mut baseline = section_generator(sources.clone());
    let expected = baseline.generate(false).unwrap();
    let mut deferred = section_generator(vec![]);
    let mut replies = 0;
    let actual = loop {
        match deferred.generate(false) {
            Ok(generated) => break generated,
            Err(error) => {
                assert_eq!(error, "Section content required");
                let request = deferred.pending_request().unwrap().clone();
                assert!(deferred.generate(true).is_err());
                deferred.supply(&request, sources[replies].clone()).unwrap();
                assert!(deferred.supply(&request, poem("duplicate")).is_err());
                replies += 1;
            }
        }
    };
    assert_eq!(replies, 3);
    assert_eq!(
        serde_json::to_value(deferred.random_state()).unwrap(),
        serde_json::to_value(baseline.random_state()).unwrap()
    );
    assert_eq!(
        serde_json::to_value(&actual).unwrap(),
        serde_json::to_value(&expected).unwrap()
    );
    assert_eq!(actual.words[0], Text::from("Section0 "));
    assert_eq!(actual.words[1], Text::from("café "));
    assert_eq!(
        serde_json::to_value(deferred.generate(true).unwrap()).unwrap(),
        serde_json::to_value(expected).unwrap()
    );
}
#[test]
fn content_retains_initial_generator_while_session_creation_waits() {
    use typing_engine::{
        Config,
        generation::{Content, Language, Prepare},
        random::Random,
    };
    let mut content = Content::default();
    content
        .prepare(Prepare {
            config: Config {
                mode: "words".into(),
                words: 2,
                funbox: vec!["poetry".into()],
                ..Config::default()
            },
            language: Language {
                name: "english".into(),
                words: vec![Text::from("base")],
                ..Language::default()
            },
            custom: None,
            random: Random::seeded(1),
            quotes: None,
            polyglot: vec![],
            selected_quote_id: 1,
            favorite_quote_ids: vec![],
            sections: vec![],
        })
        .unwrap();
    assert!(content.start_session(false).is_err());
    let request = content
        .generator()
        .unwrap()
        .pending_request()
        .unwrap()
        .clone();
    content
        .generator()
        .unwrap()
        .supply(&request, poem("one two"))
        .unwrap();
    let session = content.start_session(false).unwrap();
    assert_eq!(
        session.snapshot().words,
        vec![Text::from("one "), Text::from("two")]
    );
}

fn running_section_session(difficulty: &str) -> typing_engine::Session {
    use typing_engine::{
        Config,
        generation::{Assets, Generator, Language},
        random::Random,
    };
    let generator = Generator::with_assets(
        Config {
            mode: "time".into(),
            time: 0.0,
            difficulty: difficulty.into(),
            funbox: vec!["poetry".into()],
            ..Config::default()
        },
        Language {
            name: "english".into(),
            words: vec![Text::from("base")],
            ..Language::default()
        },
        None,
        Random::seeded(1),
        &mut Assets {
            sections: vec![poem(&vec!["one"; 100].join(" "))],
            ..Assets::default()
        },
    )
    .unwrap();
    typing_engine::Session::from_generator(generator, false).unwrap()
}
fn commit(
    session: &mut typing_engine::Session,
    text: &str,
    now: f64,
) -> typing_engine::session::Update {
    session.apply(serde_json::from_value(serde_json::json!({"op":"insert","data":Text::from(text),"now":now,"date":1_000_000.0+now})).unwrap()).unwrap()
}
#[test]
fn active_session_prefetches_then_preserves_a_committed_batch_until_reply() {
    let mut session = running_section_session("normal");
    let first = commit(&mut session, "one ", 0.0);
    let request = first.content_request.unwrap();
    assert!(!first.awaiting_content);
    assert_eq!(first.state.word_index, 1);
    let waiting = commit(&mut session, &"one ".repeat(100), 100.0);
    assert!(waiting.awaiting_content);
    assert_eq!(waiting.state.word_index, 99);
    assert_eq!(waiting.content_request, Some(request.clone()));
    let log = session.log();
    let blocked = commit(&mut session, "unaccepted", 200.0);
    assert!(blocked.awaiting_content);
    assert_eq!(log, session.log());
    session
        .apply(
            serde_json::from_value(
                serde_json::json!({"op":"delete","kind":"deleteWordBackward","now":300.0}),
            )
            .unwrap(),
        )
        .unwrap();
    assert_eq!(log, session.log());
    let resumed = session
        .apply(typing_engine::Command::SupplyContent {
            now: 1000.0,
            date: 1_001_000.0,
            request,
            source: Box::new(poem("one two three")),
        })
        .unwrap();
    assert!(!resumed.awaiting_content);
    assert_eq!(resumed.state.word_index, 101);
    assert_eq!(session.snapshot().words[101], Text::from("two "));
    let inserted = session.log()["events"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|event| event["type"] == "input")
        .count();
    assert_eq!(inserted, 404);
}
#[test]
fn reset_and_timeout_cancel_pending_reply_and_remaining_committed_units() {
    use typing_engine::Command;
    for reset in [false, true] {
        let mut session = running_section_session("normal");
        let waiting = commit(&mut session, &"one ".repeat(101), 0.0);
        assert!(waiting.awaiting_content);
        let request = waiting.content_request.unwrap();
        if !reset {
            session
                .apply(Command::Configure {
                    now: 0.0,
                    config: Box::new(typing_engine::Config {
                        mode: "time".into(),
                        time: 1.0,
                        funbox: vec!["poetry".into()],
                        ..typing_engine::Config::default()
                    }),
                })
                .unwrap();
        }
        session
            .apply(if reset {
                Command::Reset { now: 1.0 }
            } else {
                Command::Advance {
                    now: 1000.0,
                    date: 1_001_000.0,
                }
            })
            .unwrap();
        let log = session.log();
        assert!(
            session
                .apply(Command::SupplyContent {
                    now: 2.0,
                    date: 1_000_002.0,
                    request,
                    source: Box::new(poem("late content"))
                })
                .is_err()
        );
        assert_eq!(log, session.log());
        assert_eq!(session.state().ended, !reset);
    }
}
#[test]
fn failure_after_await_uses_reply_time_without_retiming_captured_input() {
    use typing_engine::Command;
    let mut session = running_section_session("master");
    for index in 0..99 {
        commit(&mut session, "one ", index as f64 * 100.0);
    }
    let waiting = commit(&mut session, "xone ", 9900.0);
    assert!(waiting.awaiting_content);
    assert!(!waiting.state.ended);
    let update = session
        .apply(Command::SupplyContent {
            now: 20000.0,
            date: 1_020_000.0,
            request: waiting.content_request.unwrap(),
            source: Box::new(poem("next section")),
        })
        .unwrap();
    assert!(update.state.ended);
    assert_eq!(update.state.word_index, 100);
    assert_eq!(update.state.reason.as_deref(), Some("difficulty"));
    let log = session.log();
    let events = log["events"].as_array().unwrap();
    assert_eq!(events.last().unwrap()["testMs"].as_f64(), Some(20000.0));
    assert_eq!(
        events
            .iter()
            .rev()
            .find(|event| event["type"] == "input")
            .unwrap()["testMs"]
            .as_f64(),
        Some(9900.0)
    );
}

#[test]
fn section_generation_and_random_draw_order_match_frozen_typescript() {
    use typing_engine::generation::{Assets, Generator};
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/typing-fixtures/oracle/section-generation.json");
    let cases: Vec<Value> = serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();
    for case in cases {
        let mut generator = Generator::with_assets(
            serde_json::from_value(case["config"].clone()).unwrap(),
            serde_json::from_value(case["language"].clone()).unwrap(),
            None,
            typing_engine::random::Random::seeded(case["seed"].as_u64().unwrap() as u32),
            &mut Assets {
                sections: serde_json::from_value(case["sources"].clone()).unwrap(),
                ..Assets::default()
            },
        )
        .unwrap();
        let mut generated = generator.generate(false).unwrap();
        if case["repeat"] == true {
            generated = generator.generate(true).unwrap();
        }
        let mut words = generated.words.clone();
        let mut extra = vec![];
        for _ in 0..case["expected"]["extra"].as_array().unwrap().len() {
            let strip = |word: &Text| {
                let mut word = word.clone();
                if matches!(word.0.last(), Some(32 | 10)) {
                    word.0.pop();
                }
                word
            };
            let previous = words.last().map(strip);
            let previous2 = words.get(words.len().wrapping_sub(2)).map(strip);
            let next = generator
                .next(words.len(), 100, previous.as_ref(), previous2.as_ref())
                .unwrap();
            words.push(next.word.clone());
            extra.push(next);
        }
        let mut actual = serde_json::to_value(generated).unwrap();
        actual["extra"] = serde_json::to_value(extra).unwrap();
        actual["allWordsGenerated"] = serde_json::json!(generator.all_generated());
        assert_eq!(actual, case["expected"], "{}", case["name"]);
        assert_eq!(
            generator.random_state().clone().draw().unwrap(),
            case["randomTail"].as_f64().unwrap(),
            "{} RNG",
            case["name"]
        );
    }
}
