use serde::de::{self, Deserializer, Visitor};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt;

use crate::kv_store::IsYomitanSchema;

pub type TermBankV3 = Vec<TermEntry>;

impl IsYomitanSchema for TermBankV3 {
    fn get_schema_prefix() -> &'static str {
        "term_bank_"
    }

    fn get_schema_name() -> &'static str {
        "Term Bank V3"
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct TermEntry {
    pub text: String,
    pub reading: String,
    #[serde(deserialize_with = "deserialize_string_separated")]
    pub tags: Option<Vec<String>>,
    pub rule_identifiers: String,
    pub score: f64,
    pub definitions: Vec<Definition>,
    pub sequence_number: i64,
    #[serde(deserialize_with = "deserialize_string_separated")]
    pub term_tags: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[serde(untagged)]
pub enum Definition {
    Simple(String),
    Structured(StructuredDefinition),
    Deinflection(DeinflectionDefinition),
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct StructuredDefinition {
    #[serde(rename = "type")]
    pub def_type: String,
    pub content: Option<serde_json::Value>,
    pub attributes: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
pub struct DeinflectionDefinition {
    pub base_form: String,
    pub inflections: Vec<String>,
}

// Custom deserializer for space-separated tags
fn deserialize_string_separated<'de, D>(deserializer: D) -> Result<Option<Vec<String>>, D::Error>
where
    D: Deserializer<'de>,
{
    struct VecStringVisitor;

    impl<'de> Visitor<'de> for VecStringVisitor {
        type Value = Option<Vec<String>>;

        fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
            formatter.write_str("string of space-separated tags, empty string, or null")
        }

        fn visit_str<E>(self, value: &str) -> Result<Self::Value, E>
        where
            E: de::Error,
        {
            if value.is_empty() {
                Ok(None)
            } else {
                Ok(Some(value.split_whitespace().map(String::from).collect()))
            }
        }

        fn visit_none<E>(self) -> Result<Self::Value, E>
        where
            E: de::Error,
        {
            // Handle explicit null values in JSON (some dictionaries have null instead of empty string)
            Ok(None)
        }

        fn visit_unit<E>(self) -> Result<Self::Value, E>
        where
            E: de::Error,
        {
            // Also handle unit type (null in JSON)
            Ok(None)
        }

        fn visit_some<E>(self, deserializer: E) -> Result<Self::Value, E::Error>
        where
            E: Deserializer<'de>,
        {
            // Deserialize the inner value for Some
            let string_val = String::deserialize(deserializer)?;
            if string_val.is_empty() {
                Ok(None)
            } else {
                Ok(Some(
                    string_val.split_whitespace().map(String::from).collect(),
                ))
            }
        }
    }

    deserializer.deserialize_option(VecStringVisitor)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_valid_term_bank() {
        let json_str = fs::read_to_string("data/dictionaries/valid-dictionary1/term_bank_1.json")
            .expect("Failed to read term_bank_1.json");

        let terms: Vec<TermEntry> =
            serde_json::from_str(&json_str).expect("Failed to parse term_bank_1.json");

        assert!(!terms.is_empty());
    }

    #[test]
    fn test_first_term_entry() {
        let json_str = fs::read_to_string("data/dictionaries/valid-dictionary1/term_bank_1.json")
            .expect("Failed to read term_bank_1.json");

        let terms: Vec<TermEntry> =
            serde_json::from_str(&json_str).expect("Failed to parse term_bank_1.json");

        // Ensure the vector is not empty
        assert!(!terms.is_empty());

        assert_eq!(terms[0].text, "打");
        assert_eq!(terms[0].reading, "だ");
        assert_eq!(terms[0].tags, Some(vec!["n".to_string()]));
        assert_eq!(terms[0].rule_identifiers, "n");
        assert_eq!(terms[0].score, 1.0);
        assert_eq!(terms[0].sequence_number, 1);
        assert_eq!(terms[0].term_tags, Some(vec!["E1".to_string()]));

        assert_eq!(terms[0].definitions.len(), 2);
        assert_eq!(
            terms[0].definitions[0],
            Definition::Simple("da definition 1".to_string())
        );
        assert_eq!(
            terms[0].definitions[1],
            Definition::Simple("da definition 2".to_string())
        );

        assert_eq!(terms[1].text, "打");
        assert_eq!(terms[1].reading, "ダース");
        assert_eq!(
            terms[1].tags,
            Some(vec!["n".to_string(), "abbr".to_string()])
        );
        assert_eq!(terms[1].rule_identifiers, "n");
        assert_eq!(terms[1].score, 1.0);
        assert_eq!(terms[1].sequence_number, 2);
        assert_eq!(terms[1].term_tags, Some(vec!["E1".to_string()]));

        assert_eq!(terms[1].definitions.len(), 2);
        assert_eq!(
            terms[1].definitions[0],
            Definition::Simple("daasu definition 1".to_string())
        );
        assert_eq!(
            terms[1].definitions[1],
            Definition::Simple("daasu definition 2".to_string())
        );

        assert_eq!(terms[2].text, "打つ");
        assert_eq!(terms[2].reading, "うつ");
        assert_eq!(terms[2].tags, Some(vec!["vt".to_string()]));
        assert_eq!(terms[2].rule_identifiers, "v5");
        assert_eq!(terms[2].score, 10.0);
        assert_eq!(terms[2].sequence_number, 3);
        assert_eq!(
            terms[2].term_tags,
            Some(vec!["P".to_string(), "E1".to_string()])
        );

        assert_eq!(terms[2].definitions.len(), 2);
        assert_eq!(
            terms[2].definitions[0],
            Definition::Simple("utsu definition 1".to_string())
        );
        assert_eq!(
            terms[2].definitions[1],
            Definition::Simple("utsu definition 2".to_string())
        );

        assert_eq!(terms[3].text, "打つ");
        assert_eq!(terms[3].reading, "うつ");
        assert_eq!(terms[3].tags, Some(vec!["vt".to_string()]));
        assert_eq!(terms[3].rule_identifiers, "v5");
        assert_eq!(terms[3].score, 1.0);
        assert_eq!(terms[3].sequence_number, 3);
        assert_eq!(
            terms[3].term_tags,
            Some(vec!["P".to_string(), "E2".to_string()])
        );

        assert_eq!(terms[3].definitions.len(), 2);
        assert_eq!(
            terms[3].definitions[0],
            Definition::Simple("utsu definition 3".to_string())
        );
        assert_eq!(
            terms[3].definitions[1],
            Definition::Simple("utsu definition 4".to_string())
        );

        assert_eq!(terms[4].text, "打つ");
        assert_eq!(terms[4].reading, "ぶつ");
        assert_eq!(terms[4].tags, Some(vec!["vt".to_string()]));
        assert_eq!(terms[4].rule_identifiers, "v5");
        assert_eq!(terms[4].score, 10.0);
        assert_eq!(terms[4].sequence_number, 3);
        assert_eq!(
            terms[4].term_tags,
            Some(vec!["P".to_string(), "E1".to_string()])
        );

        assert_eq!(terms[4].definitions.len(), 2);
        assert_eq!(
            terms[4].definitions[0],
            Definition::Simple("butsu definition 1".to_string())
        );
        assert_eq!(
            terms[4].definitions[1],
            Definition::Simple("butsu definition 2".to_string())
        );

        assert_eq!(terms[5].text, "打つ");
        assert_eq!(terms[5].reading, "ぶつ");
        assert_eq!(terms[5].tags, Some(vec!["vt".to_string()]));
        assert_eq!(terms[5].rule_identifiers, "v5");
        assert_eq!(terms[5].score, 1.0);
        assert_eq!(terms[5].sequence_number, 3);
        assert_eq!(
            terms[5].term_tags,
            Some(vec!["P".to_string(), "E2".to_string()])
        );

        assert_eq!(terms[5].definitions.len(), 2);
        assert_eq!(
            terms[5].definitions[0],
            Definition::Simple("butsu definition 3".to_string())
        );
        assert_eq!(
            terms[5].definitions[1],
            Definition::Simple("butsu definition 4".to_string())
        );

        // TODO: Add more tests for the rest of the entries
    }

    #[test]
    fn test_null_tags_deserialization() {
        // Test that entries with null tags deserialize correctly
        let json_str = r#"[
            ["糖","とう",null,"",0,["definition"],30679,""]
        ]"#;

        let terms: Vec<TermEntry> =
            serde_json::from_str(json_str).expect("Failed to parse entries with null tags");

        assert_eq!(terms.len(), 1);
        assert_eq!(terms[0].text, "糖");
        assert_eq!(terms[0].reading, "とう");
        // null should deserialize to None
        assert_eq!(terms[0].tags, None);
        assert_eq!(terms[0].rule_identifiers, "");
    }

    #[test]
    fn test_empty_string_tags_deserialization() {
        // Test that entries with empty string tags deserialize to None
        let json_str = r#"[
            ["糖質","とうしつ","","",0,["definition"],122471,""]
        ]"#;

        let terms: Vec<TermEntry> =
            serde_json::from_str(json_str).expect("Failed to parse entries with empty string tags");

        assert_eq!(terms.len(), 1);
        assert_eq!(terms[0].text, "糖質");
        assert_eq!(terms[0].reading, "とうしつ");
        // empty string should deserialize to None
        assert_eq!(terms[0].tags, None);
    }

    #[test]
    fn test_space_separated_tags_deserialization() {
        // Test that space-separated tags deserialize correctly
        let json_str = r#"[
            ["打","だ","n","n",1,["definition"],1,"E1"]
        ]"#;

        let terms: Vec<TermEntry> = serde_json::from_str(json_str)
            .expect("Failed to parse entries with space-separated tags");

        assert_eq!(terms.len(), 1);
        assert_eq!(terms[0].text, "打");
        assert_eq!(terms[0].reading, "だ");
        // "n" should deserialize to Some(["n"])
        assert_eq!(terms[0].tags, Some(vec!["n".to_string()]));
        // "E1" should deserialize to Some(["E1"])
        assert_eq!(terms[0].term_tags, Some(vec!["E1".to_string()]));
    }

    #[test]
    fn test_multiple_space_separated_tags_deserialization() {
        // Test that multiple space-separated tags deserialize correctly
        let json_str = r#"[
            ["打","ダース","n abbr","n",1,["definition"],2,"E1 P"]
        ]"#;

        let terms: Vec<TermEntry> = serde_json::from_str(json_str)
            .expect("Failed to parse entries with multiple space-separated tags");

        assert_eq!(terms.len(), 1);
        assert_eq!(terms[0].text, "打");
        // "n abbr" should split into ["n", "abbr"]
        assert_eq!(
            terms[0].tags,
            Some(vec!["n".to_string(), "abbr".to_string()])
        );
        // "E1 P" should split into ["E1", "P"]
        assert_eq!(
            terms[0].term_tags,
            Some(vec!["E1".to_string(), "P".to_string()])
        );
    }

    #[test]
    fn test_mixed_null_and_empty_tags() {
        // Test that we can deserialize entries with mixed null and empty tags
        let json_str = r#"[
            ["糖","とう",null,"",0,["def1"],1,""],
            ["糖質","とうしつ","","",0,["def2"],2,"P E1"],
            ["打","だ","n","n",1,["def3"],3,null]
        ]"#;

        let terms: Vec<TermEntry> =
            serde_json::from_str(json_str).expect("Failed to parse mixed entries");

        assert_eq!(terms.len(), 3);

        // First entry: null tags
        assert_eq!(terms[0].tags, None);
        assert_eq!(terms[0].term_tags, None);

        // Second entry: empty string tags, space-separated term_tags
        assert_eq!(terms[1].tags, None);
        assert_eq!(
            terms[1].term_tags,
            Some(vec!["P".to_string(), "E1".to_string()])
        );

        // Third entry: space-separated tags, null term_tags
        assert_eq!(terms[2].tags, Some(vec!["n".to_string()]));
        assert_eq!(terms[2].term_tags, None);
    }
}
