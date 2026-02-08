use serde::{Deserialize, Serialize};

use crate::kv_store::IsYomitanSchema;

pub type TagBankV3 = Vec<TagEntry>;

impl IsYomitanSchema for TagBankV3 {
    fn get_schema_prefix() -> &'static str {
        "tag_bank_"
    }

    fn get_schema_name() -> &'static str {
        "Tag Bank V3"
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct TagEntry {
    pub tag_name: String,
    pub category: String,
    pub sorting_order: f64,
    pub notes: String,
    pub popularity_score: f64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_valid_tag_bank() {
        let json_str = fs::read_to_string("data/dictionaries/valid-dictionary1/tag_bank_1.json")
            .expect("Failed to read tag_bank_1.json");

        let tags: Vec<TagEntry> =
            serde_json::from_str(&json_str).expect("Failed to parse tag_bank_1.json");

        // Test first tag entry
        assert_eq!(tags[0].tag_name, "E1");
        assert_eq!(tags[0].category, "default");
        assert_eq!(tags[0].sorting_order, 0.0);
        assert_eq!(tags[0].notes, "example tag 1");
        assert_eq!(tags[0].popularity_score, 0.0);
    }
}
