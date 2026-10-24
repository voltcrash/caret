use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{collections::BTreeMap, sync::OnceLock};
use ts_rs::TS;
#[derive(Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Metadata {
    pub name: String,
    pub properties: Vec<String>,
    pub frontend_functions: Vec<String>,
    pub frontend_forced_config: BTreeMap<String, Vec<Value>>,
    pub can_get_pb: bool,
    pub difficulty_level: u8,
    pub css_modifications: Vec<String>,
}
impl Metadata {
    fn property(&self, name: &str) -> bool {
        self.properties.iter().any(|p| p == name)
    }
    fn function(&self, name: &str) -> bool {
        self.frontend_functions.iter().any(|p| p == name)
    }
}
pub fn all() -> &'static [Metadata] {
    static METADATA: OnceLock<Vec<Metadata>> = OnceLock::new();
    METADATA.get_or_init(|| {
        serde_json::from_str(include_str!("../data/funboxes.json"))
            .expect("Checked immutable funbox metadata")
    })
}
pub fn get(name: &str) -> Option<&'static Metadata> {
    all().iter().find(|f| f.name == name)
}
pub fn has_property(names: &[String], property: &str) -> bool {
    names
        .iter()
        .filter_map(|n| get(n))
        .any(|f| f.property(property))
}
pub fn has_function(names: &[String], function: &str) -> bool {
    names
        .iter()
        .filter_map(|n| get(n))
        .any(|f| f.function(function))
}
pub fn to_push(names: &[String]) -> Option<usize> {
    names
        .iter()
        .filter_map(|n| get(n))
        .flat_map(|f| &f.properties)
        .find_map(|p| p.strip_prefix("toPush:").and_then(|n| n.parse().ok()))
}
pub fn compatible(names: &[String]) -> bool {
    let Some(funboxes): Option<Vec<_>> = names.iter().map(|n| get(n)).collect() else {
        return false;
    };
    let count =
        |predicate: &dyn Fn(&Metadata) -> bool| funboxes.iter().filter(|f| predicate(f)).count();
    let prop = |name: &str| count(&|f| f.property(name));
    let function = |name: &str| count(&|f| f.function(name));
    if count(&|f| f.function("getWord") || f.function("pullSection") || f.function("withWords")) > 1
        || count(&|f| f.properties.iter().any(|p| p.starts_with("wordOrder"))) > 1
        || (prop("changesLayout") > 0 && (prop("ignoresLayout") > 0 || prop("usesLayout") > 0))
        || count(&|f| {
            f.properties
                .iter()
                .any(|p| p == "nospace" || p.starts_with("toPush"))
        }) > 1
        || prop("changesWordsVisibility") > 1
        || prop("changesWordsFrequency") > 1
        || (prop("changesWordsFrequency") > 0 && prop("ignoresLanguage") > 0)
        || (prop("noLetters") > 0 && prop("changesCapitalisation") > 0)
        || (prop("conflictsWithSymmetricChars") > 0 && prop("symmetricChars") > 0)
        || prop("speaks") > 1
        || !(prop("speaks") == 0
            || (prop("speaks") == 1 && prop("unspeakable") == 0)
            || prop("ignoresLanguage") == 0)
        || count(&|f| {
            f.properties.iter().any(|p| p.starts_with("toPush:")) || f.function("pullSection")
        }) > 1
        || function("punctuateWord") > 1
        || function("getEmulatedChar") > 1
        || function("getWordNode") > 1
        || prop("changesCapitalisation") > 1
    {
        return false;
    }
    let mut css = vec![];
    let mut allowed: BTreeMap<&str, &Vec<Value>> = BTreeMap::new();
    for funbox in funboxes {
        for element in &funbox.css_modifications {
            if css.contains(element) {
                return false;
            }
            css.push(element.clone());
        }
        for (key, values) in &funbox.frontend_forced_config {
            if let Some(previous) = allowed.get(key.as_str()) {
                // Preserve the original pairwise-against-first check.
                if !previous.iter().any(|v| values.contains(v)) {
                    return false;
                }
            } else {
                allowed.insert(key, values);
            }
        }
    }
    true
}
#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Forced {
    pub result: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub forced_configs: Option<Vec<Value>>,
}
pub fn forced(key: &str, value: &Value, names: &[String]) -> Result<Forced, String> {
    let funboxes: Vec<_> = names
        .iter()
        .map(|n| get(n).ok_or_else(|| format!("Invalid funbox name: {n}")))
        .collect::<Result<_, _>>()?;
    if key == "words" || key == "time" {
        if value.as_f64() == Some(0.0) && funboxes.iter().any(|f| f.property("noInfiniteDuration"))
        {
            return Ok(Forced {
                result: false,
                forced_configs: Some(vec![json!(if key == "words" { 10 } else { 15 })]),
            });
        }
        return Ok(Forced {
            result: true,
            forced_configs: None,
        });
    }
    let mut allowed: BTreeMap<&str, Vec<Value>> = BTreeMap::new();
    for funbox in funboxes {
        for (key, values) in &funbox.frontend_forced_config {
            if let Some(previous) = allowed.get_mut(key.as_str()) {
                if values.len() > previous.len() {
                    let mut next = values.clone();
                    next.retain(|v| previous.contains(v));
                    *previous = next;
                } else {
                    previous.retain(|v| values.contains(v));
                }
                let mut seen = vec![];
                previous.retain(|v| {
                    if seen.contains(v) {
                        false
                    } else {
                        seen.push(v.clone());
                        true
                    }
                });
            } else {
                allowed.insert(key, values.clone());
            }
        }
    }
    match allowed.remove(key) {
        Some(values) if values.is_empty() => Err("No intersection of forced configs".into()),
        Some(values) => Ok(Forced {
            result: values.contains(value),
            forced_configs: Some(values),
        }),
        None => Ok(Forced {
            result: true,
            forced_configs: None,
        }),
    }
}
pub fn can_set(key: &str, value: &Value, names: &[String]) -> Result<bool, String> {
    if key == "mode" {
        for name in names {
            let f = get(name).ok_or("Invalid funbox name")?;
            if f.frontend_forced_config
                .get("mode")
                .is_some_and(|modes| !modes.contains(value))
            {
                return Ok(false);
            }
            let mode = value.as_str().unwrap_or_default();
            if mode == "zen"
                && (f.frontend_functions.iter().any(|name| {
                    ["getWord", "pullSection", "alterText", "withWords"].contains(&name.as_str())
                }) || f.properties.iter().any(|name| {
                    [
                        "changesCapitalisation",
                        "nospace",
                        "changesWordsVisibility",
                        "speaks",
                        "changesLayout",
                        "changesWordsFrequency",
                    ]
                    .contains(&name.as_str())
                        || name.starts_with("toPush:")
                }))
            {
                return Ok(false);
            }
            if ["quote", "custom"].contains(&mode)
                && (f
                    .frontend_functions
                    .iter()
                    .any(|name| ["getWord", "pullSection", "withWords"].contains(&name.as_str()))
                    || f.property("changesWordsFrequency"))
            {
                return Ok(false);
            }
        }
    }
    Ok(forced(key, value, names)?.result)
}
