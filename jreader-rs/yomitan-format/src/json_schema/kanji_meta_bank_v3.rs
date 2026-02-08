use serde::{Deserialize, Serialize};

use crate::kv_store::IsYomitanSchema;

pub type KanjiMetaBankV3 = Vec<KanjiMetaEntry>;

impl IsYomitanSchema for KanjiMetaBankV3 {
    fn get_schema_prefix() -> &'static str {
        "kanji_meta_bank_"
    }

    fn get_schema_name() -> &'static str {
        "Kanji Meta Bank V3"
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
pub struct KanjiMetaEntry(
    pub String,    // Kanji character
    pub String,    // Type (always "freq")
    pub Frequency, // Frequency data
);

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum Frequency {
    Simple(SimpleFreq),
    Detailed(DetailedFreq),
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum SimpleFreq {
    Num(f64),
    Str(String),
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DetailedFreq {
    pub value: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display_value: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_valid_kanji_meta_bank() {
        let json_str =
            fs::read_to_string("data/dictionaries/valid-dictionary1/kanji_meta_bank_1.json")
                .expect("Failed to read kanji_meta_bank_1.json");

        let bank: Vec<KanjiMetaEntry> =
            serde_json::from_str(&json_str).expect("Failed to parse kanji_meta_bank_1.json");

        assert_eq!(bank[0].0, "打");
        assert_eq!(bank[0].1, "freq");
        match &bank[0].2 {
            Frequency::Simple(SimpleFreq::Num(n)) => assert_eq!(*n, 1.0),
            _ => panic!("Expected simple numeric frequency"),
        }

        assert_eq!(bank[1].0, "込");
        assert_eq!(bank[1].1, "freq");
        match &bank[1].2 {
            Frequency::Simple(SimpleFreq::Num(n)) => assert_eq!(*n, 2.0),
            _ => panic!("Expected simple numeric frequency"),
        }

        assert_eq!(bank[2].0, "打");
        assert_eq!(bank[2].1, "freq");
        match &bank[2].2 {
            Frequency::Simple(SimpleFreq::Str(s)) => assert_eq!(s, "three"),
            _ => panic!("Expected simple string frequency"),
        }

        assert_eq!(bank[3].0, "込");
        assert_eq!(bank[3].1, "freq");
        match &bank[3].2 {
            Frequency::Simple(SimpleFreq::Str(s)) => assert_eq!(s, "four (4)"),
            _ => panic!("Expected simple string frequency"),
        }

        assert_eq!(bank[4].0, "打");
        assert_eq!(bank[4].1, "freq");
        match &bank[4].2 {
            Frequency::Detailed(d) => {
                assert_eq!(d.value, 5.0);
                assert!(d.display_value.is_none());
            }
            _ => panic!("Expected detailed frequency"),
        }

        assert_eq!(bank[5].0, "込");
        assert_eq!(bank[5].1, "freq");
        match &bank[5].2 {
            Frequency::Detailed(d) => {
                assert_eq!(d.value, 6.0);
                assert_eq!(d.display_value.as_deref(), Some("six"));
            }
            _ => panic!("Expected detailed frequency"),
        }
    }
}
