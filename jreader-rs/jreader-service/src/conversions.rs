use crate::{dictionaries, http_handlers};
use std::collections::HashMap;
use wana_kana::ConvertJapanese;
use yomitan_format::json_schema::term_bank_v3;

pub fn convert_term_entry(entry: &term_bank_v3::TermEntry) -> http_handlers::TermEntry {
    http_handlers::TermEntry {
        text: entry.text.clone(),
        reading: entry.reading.clone().to_hiragana(),
        tags: entry.tags.clone().unwrap_or_default(),
        rule_identifiers: entry.rule_identifiers.clone(),
        score: entry.score,
        definitions: entry
            .definitions
            .iter()
            .map(|d| convert_definition(d))
            .collect(),
        sequence_number: entry.sequence_number,
        term_tags: entry.tags.clone().unwrap_or_default(),
    }
}

pub fn convert_definition(definition: &term_bank_v3::Definition) -> http_handlers::Definition {
    match definition {
        term_bank_v3::Definition::Simple(s) => {
            http_handlers::Definition::Simple { content: s.clone() }
        }
        term_bank_v3::Definition::Structured(s) => http_handlers::Definition::Structured {
            type_: s.def_type.clone(),
            content: s
                .content
                .as_ref()
                .map_or_else(String::new, |v| v.to_string()),
            attributes: s.attributes.as_ref().map_or_else(HashMap::new, |m| {
                m.iter().map(|(k, v)| (k.clone(), v.to_string())).collect()
            }),
        },
        term_bank_v3::Definition::Deinflection(d) => http_handlers::Definition::Deinflection {
            base_form: d.base_form.clone(),
            inflections: d.inflections.clone(),
        },
    }
}

pub fn convert_dictionary_result(
    result: &dictionaries::DictionaryResult,
) -> http_handlers::DictionaryResult {
    http_handlers::DictionaryResult {
        title: result.title.clone(),
        revision: result.revision.clone(),
        origin: result.origin.clone(),
        entries: result.entries.iter().map(convert_term_entry).collect(),
    }
}

pub fn convert_frequency_data(
    f: &HashMap<String, Vec<dictionaries::FrequencyData>>,
) -> HashMap<String, http_handlers::FrequencyDataList> {
    f.iter()
        .map(|(k, v)| {
            (
                k.clone(),
                http_handlers::FrequencyDataList {
                    items: v.iter().map(convert_single_frequency_data).collect(),
                },
            )
        })
        .collect()
}

pub fn convert_single_frequency_data(
    f: &dictionaries::FrequencyData,
) -> http_handlers::FrequencyData {
    http_handlers::FrequencyData {
        term: f.term.clone(),
        reading: f.reading.clone().map(|r| r.to_hiragana()),
        value: f.value,
        display_value: f.display_value.clone(),
    }
}

pub fn convert_pitch_result(
    reading: &str,
    pr: &dictionaries::PitchResult,
) -> http_handlers::PitchAccentResult {
    let mut pitch_accent_entries: HashMap<String, http_handlers::PitchAccentEntryList> =
        HashMap::new();
    for pa in pr.pitch_accents.0.iter() {
        if !pitch_accent_entries.contains_key(&pa.reading) {
            pitch_accent_entries.insert(
                pa.reading.clone(),
                http_handlers::PitchAccentEntryList {
                    entries: Vec::new(),
                },
            );
        }
        pitch_accent_entries
            .get_mut(&pa.reading)
            .unwrap()
            .entries
            .push(convert_pitch_accent(pa));
    }
    http_handlers::PitchAccentResult {
        title: pr.title.clone(),
        entries: pitch_accent_entries,
    }
}

pub fn convert_pitch_accent(pa: &dictionaries::PitchAccent) -> http_handlers::PitchAccentEntry {
    http_handlers::PitchAccentEntry {
        reading: pa.reading.clone().to_hiragana(),
        position: pa.position as u32,
        mora_count: pa.mora_count as u32,
    }
}
