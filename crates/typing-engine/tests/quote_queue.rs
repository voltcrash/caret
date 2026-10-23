use serde_json::{Value, json};
use typing_engine::{
    Text,
    generation::{Content, Prepare},
    random::Random,
};
#[test]
fn explicit_quote_length_changes_match_frozen_owned_queue_and_random_draws() {
    let reference: Value = serde_json::from_slice(
        &std::fs::read(
            std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../../packages/typing-fixtures/oracle/quote-queue.json"),
        )
        .unwrap(),
    )
    .unwrap();
    let mut asset = reference["asset"].clone();
    for quote in asset["quotes"].as_array_mut().unwrap() {
        quote["text"] = json!(Text::from(quote["text"].as_str().unwrap()));
    }
    let prepare = |lengths: &Value, asset: Value| -> Prepare {
        serde_json::from_value(json!({"config":{"mode":"quote","quoteLength":lengths},"language":{"name":"english","words":[[97]]},"random":{"kind":"seeded","state":91},"quotes":asset})).unwrap()
    };
    let mut content = Content::default();
    content.prepare(prepare(&json!([0]), asset)).unwrap();
    assert_eq!(
        json!(
            content
                .generator()
                .unwrap()
                .current_quote
                .as_ref()
                .unwrap()
                .id
        ),
        reference["initialId"]
    );
    for cycle in reference["cycles"].as_array().unwrap() {
        let lengths: Vec<i32> = serde_json::from_value(cycle["lengths"].clone()).unwrap();
        let state = content
            .update_quote_queue(&lengths, Random::seeded(91))
            .unwrap();
        assert_eq!(json!(state)["state"], cycle["afterUpdateState"]);
        for selected in cycle["selected"].as_array().unwrap() {
            content
                .prepare(prepare(&cycle["lengths"], Value::Null))
                .unwrap();
            let generator = content.generator().unwrap();
            assert_eq!(
                json!(generator.current_quote.as_ref().unwrap().id),
                selected["id"]
            );
            assert_eq!(
                json!(generator.random_state())["state"],
                selected["afterSelectState"]
            );
        }
    }
}

fn web_quote(mut value: Value) -> Value {
    if value.is_null() {
        return value;
    }
    for key in ["text", "britishText"] {
        if let Some(units) = value.get(key).filter(|value| !value.is_null()) {
            let units: Vec<u16> = serde_json::from_value(units.clone()).unwrap();
            value[key] = json!(String::from_utf16(&units).unwrap());
        }
    }
    if value["textSplit"].as_array().is_some_and(Vec::is_empty) {
        value.as_object_mut().unwrap().remove("textSplit");
    } else if let Some(parts) = value.get_mut("textSplit").and_then(Value::as_array_mut) {
        for part in parts {
            let units: Vec<u16> = serde_json::from_value(part.clone()).unwrap();
            *part = json!(String::from_utf16(&units).unwrap());
        }
    }
    value
}
#[test]
fn catalog_reads_match_original_collections_retained_queues_and_rng_exactly() {
    let reference: Value = serde_json::from_str(include_str!(
        "../../../packages/typing-fixtures/oracle/quote-catalog-v2.json"
    ))
    .unwrap();
    let mut quotes = typing_engine::quotes::Quotes::default();
    let mut random = Random::seeded(reference["seed"].as_u64().unwrap() as u32);
    for action in reference["actions"].as_array().unwrap() {
        match action["op"].as_str().unwrap() {
            "load" => {
                let mut asset = reference["assets"][action["language"].as_str().unwrap()].clone();
                for quote in asset["quotes"].as_array_mut().unwrap() {
                    quote["text"] = json!(Text::from(quote["text"].as_str().unwrap()));
                }
                let lengths: Option<Vec<i32>> = action
                    .get("lengths")
                    .map(|value| serde_json::from_value(value.clone()).unwrap());
                let collection = quotes
                    .load_catalog(
                        serde_json::from_value(asset).unwrap(),
                        lengths.as_deref(),
                        &mut random,
                    )
                    .unwrap();
                let items: Vec<Value> = collection
                    .quotes
                    .into_iter()
                    .map(|quote| web_quote(json!(quote)))
                    .collect();
                let groups: Vec<Vec<Value>> = collection
                    .groups
                    .into_iter()
                    .map(|group| {
                        group
                            .into_iter()
                            .map(|index| items[index].clone())
                            .collect()
                    })
                    .collect();
                assert_eq!(
                    json!({"quotes":items,"groups":groups,"length":collection.length,"language":collection.language}),
                    action["expected"]
                );
            }
            "select" => assert_eq!(
                web_quote(json!(quotes.random_quote(&mut random).unwrap())),
                action["expected"]
            ),
            "update" => quotes
                .update_queue(
                    &serde_json::from_value::<Vec<i32>>(action["lengths"].clone()).unwrap(),
                    &mut random,
                )
                .unwrap(),
            _ => panic!("Unexpected oracle action"),
        }
        assert_eq!(json!(random)["state"], action["randomState"], "{action}");
    }
}

#[test]
fn selected_quote_normalization_remains_visible_in_the_owned_catalog() {
    let reference: Value = serde_json::from_str(include_str!(
        "../../../packages/typing-fixtures/oracle/quote-catalog-selection.json"
    ))
    .unwrap();
    let mut asset = reference["asset"].clone();
    for quote in asset["quotes"].as_array_mut().unwrap() {
        for key in ["text", "britishText"] {
            quote[key] = json!(Text::from(quote[key].as_str().unwrap()));
        }
    }
    let mut quotes = typing_engine::quotes::Quotes::default();
    let mut random = Random::seeded(11);
    quotes
        .load(serde_json::from_value(asset).unwrap(), &[-2], &mut random)
        .unwrap();
    for stage in reference["stages"].as_array().unwrap() {
        let selected = quotes
            .select(
                "swiss_german",
                &[-2],
                1,
                &[],
                stage["british"].as_bool().unwrap(),
                &mut random,
            )
            .unwrap();
        assert_eq!(
            web_quote(json!(&selected)),
            stage["expected"]["currentQuote"]
        );
        let words: Vec<_> = selected
            .text_split
            .iter()
            .map(|text| String::from_utf16(&text.0).unwrap())
            .collect();
        assert_eq!(json!(words), stage["expected"]["words"]);
        let collection = quotes.collection();
        let items: Vec<Value> = collection
            .quotes
            .into_iter()
            .map(|quote| web_quote(json!(quote)))
            .collect();
        let groups: Vec<Vec<Value>> = collection
            .groups
            .into_iter()
            .map(|group| {
                group
                    .into_iter()
                    .map(|index| items[index].clone())
                    .collect()
            })
            .collect();
        assert_eq!(
            json!({"quotes":items,"groups":groups,"length":collection.length,"language":collection.language}),
            stage["expected"]["collection"]
        );
    }
}
