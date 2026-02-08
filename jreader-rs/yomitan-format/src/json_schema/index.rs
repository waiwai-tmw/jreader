use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DictionaryIndex {
    pub title: String,
    pub revision: String,
    #[serde(default)]
    pub sequenced: bool,
    #[serde(alias = "version")]
    pub format: Option<i32>,
    pub author: Option<String>,
    #[serde(default)]
    pub is_updatable: bool,
    pub index_url: Option<String>,
    pub download_url: Option<String>,
    pub url: Option<String>,
    pub description: Option<String>,
    pub attribution: Option<String>,
    pub source_language: Option<String>,
    pub target_language: Option<String>,
    pub frequency_mode: Option<FrequencyMode>,
    pub tag_meta: Option<HashMap<String, TagMetaInfo>>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum FrequencyMode {
    OccurrenceBased,
    RankBased,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TagMetaInfo {
    pub category: Option<String>,
    pub order: Option<f64>,
    pub notes: Option<String>,
    pub score: Option<f64>,
}

impl DictionaryIndex {
    pub fn validate(&self) -> Result<(), String> {
        // Validate format/version is within allowed values
        if let Some(format) = self.format {
            if ![1, 2, 3].contains(&format) {
                return Err("Format must be 1, 2, or 3".to_string());
            }
        }

        // Validate language codes
        if let Some(ref lang) = self.source_language {
            if !is_valid_iso_language_code(lang) {
                return Err("Invalid source language code".to_string());
            }
        }
        if let Some(ref lang) = self.target_language {
            if !is_valid_iso_language_code(lang) {
                return Err("Invalid target language code".to_string());
            }
        }

        // Validate isUpdatable dependencies
        if self.is_updatable {
            if self.index_url.is_none() || self.download_url.is_none() {
                return Err("isUpdatable requires indexUrl and downloadUrl".to_string());
            }
        }

        Ok(())
    }
}

fn is_valid_iso_language_code(code: &str) -> bool {
    matches!(code.len(), 2 | 3) && code.chars().all(|c| c.is_ascii_lowercase())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_valid_dictionary1_index() {
        let json_str = fs::read_to_string("data/dictionaries/valid-dictionary1/index.json")
            .expect("Failed to read index.json");

        let index: DictionaryIndex =
            serde_json::from_str(&json_str).expect("Failed to parse index.json");

        assert_eq!(index.title, "Test Dictionary");
        assert_eq!(index.revision, "test");
        assert_eq!(index.format, Some(3));
        assert_eq!(index.sequenced, true);

        // Validate optional fields are None
        assert!(index.author.is_none());
        assert!(index.index_url.is_none());
        assert!(index.download_url.is_none());
        assert!(index.url.is_none());
        assert!(index.description.is_none());
        assert!(index.attribution.is_none());
        assert!(index.tag_meta.is_none());
        assert!(index.source_language.is_none());
        assert!(index.target_language.is_none());
        assert!(index.frequency_mode.is_none());

        // Validate the index
        index.validate().expect("Index should be valid");
    }
}
