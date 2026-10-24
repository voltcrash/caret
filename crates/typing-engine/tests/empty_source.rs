use serde_json::{Value, json};
use typing_engine::{
    Text,
    content::{Queue, Source},
    error::ErrorCode,
};

#[test]
fn empty_wikipedia_cleanup_keeps_one_retryable_request_until_frozen_nonempty_article() {
    let fixture: Value = serde_json::from_slice(
        &std::fs::read(
            std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../packages/typing-fixtures/oracle/wikipedia-retry.json"),
        )
        .unwrap(),
    )
    .unwrap();
    let mut queue = Queue::new("wikipedia".into(), "english".into(), true);
    let request = queue.request();
    for (index, text) in fixture["extracts"].as_array().unwrap().iter().enumerate() {
        let result = queue.supply(
            &request,
            Source::Article {
                title: Text::from(format!("Article {}", index + 1).as_str()),
                author: Some(Text::from("Writer")),
                plain_text: Text::from(text.as_str().unwrap()),
            },
        );
        if index == 0 {
            assert_eq!(result.unwrap_err().code, ErrorCode::EmptyContent);
            assert_eq!(queue.pending(), Some(&request));
            assert!(queue.pop().is_none());
        } else {
            result.unwrap();
            assert!(queue.pending().is_none());
            let section = queue.pop().unwrap();
            assert_eq!(
                json!({"title":section.title.display_lossy(), "author":section.author.unwrap().display_lossy(), "words":section.words.iter().map(Text::display_lossy).collect::<Vec<_>>()}),
                fixture["expected"]
            );
        }
    }
}
