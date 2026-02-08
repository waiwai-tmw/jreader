use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::kv_store::IsYomitanSchema;

pub type KanjiBankV3 = Vec<KanjiEntry>;

impl IsYomitanSchema for KanjiBankV3 {
    fn get_schema_prefix() -> &'static str {
        "kanji_bank_"
    }

    fn get_schema_name() -> &'static str {
        "Kanji Bank V3"
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct KanjiEntry(
    pub String,                  // Kanji character
    pub String,                  // Onyomi readings
    pub String,                  // Kunyomi readings
    pub String,                  // Tags
    pub Vec<String>,             // Meanings
    pub HashMap<String, String>, // Stats
);

impl KanjiEntry {
    pub fn validate(&self) -> Result<(), String> {
        // Validate kanji character is not empty
        if self.0.is_empty() {
            return Err("Kanji character cannot be empty".to_string());
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_valid_kanji_bank() {
        let json_str = fs::read_to_string("data/dictionaries/valid-dictionary1/kanji_bank_1.json")
            .expect("Failed to read kanji_bank_1.json");

        let bank: Vec<KanjiEntry> =
            serde_json::from_str(&json_str).expect("Failed to parse kanji_bank_1.json");

        // Assert all data for each KanjiEntry
        assert_eq!(bank[0].0, "打");
        assert_eq!(bank[0].1, "ダ ダアス");
        assert_eq!(bank[0].2, "う.つ う.ち- ぶ.つ");
        assert_eq!(bank[0].3, "K1 K2");
        assert_eq!(
            bank[0].4,
            vec![
                "utsu meaning 1",
                "utsu meaning 2",
                "utsu meaning 3",
                "utsu meaning 4",
                "utsu meaning 5"
            ]
        );
        assert_eq!(bank[0].5, {
            let mut stats = HashMap::new();
            stats.insert("kstat1".to_string(), "kanji stat 1 value".to_string());
            stats.insert("kstat2".to_string(), "kanji stat 2 value".to_string());
            stats.insert("kstat3".to_string(), "kanji stat 3 value".to_string());
            stats.insert("kstat4".to_string(), "kanji stat 4 value".to_string());
            stats.insert("kstat5".to_string(), "kanji stat 5 value".to_string());
            stats
        });

        assert_eq!(bank[1].0, "込");
        assert_eq!(bank[1].1, "");
        assert_eq!(bank[1].2, "-こ.む こ.む こ.み -こ.み こ.める");
        assert_eq!(bank[1].3, "K1 K2");
        assert_eq!(
            bank[1].4,
            vec![
                "komu meaning 1",
                "komu meaning 2",
                "komu meaning 3",
                "komu meaning 4",
                "komu meaning 5"
            ]
        );
        assert_eq!(bank[1].5, {
            let mut stats = HashMap::new();
            stats.insert("kstat1".to_string(), "kanji stat 1 value".to_string());
            stats.insert("kstat2".to_string(), "kanji stat 2 value".to_string());
            stats.insert("kstat3".to_string(), "kanji stat 3 value".to_string());
            stats.insert("kstat4".to_string(), "kanji stat 4 value".to_string());
            stats.insert("kstat5".to_string(), "kanji stat 5 value".to_string());
            stats
        });

        // Validate all entries
        for entry in &bank {
            entry.validate().expect("Entry should be valid");
        }
    }
}
