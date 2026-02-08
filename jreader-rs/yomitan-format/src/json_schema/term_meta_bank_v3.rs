use serde::{
    de::{self, SeqAccess, Visitor},
    Deserialize, Deserializer, Serialize,
};
use std::fmt;

use crate::kv_store::IsYomitanSchema;

pub type TermMetaBankV3 = Vec<TermMetaEntry>;

impl IsYomitanSchema for TermMetaBankV3 {
    fn get_schema_prefix() -> &'static str {
        "term_meta_bank_"
    }

    fn get_schema_name() -> &'static str {
        "Term Meta Bank V3"
    }
}

#[derive(Debug, Serialize, Clone, PartialEq)]
pub struct TermMetaEntry {
    pub term: String,
    pub entry_type: String,
    pub data: TermMetaData,
}

pub struct FrequencyUnion {
    pub value: Option<i32>,
    pub display_value: Option<String>,
    pub reading: Option<String>,
}

impl TermMetaEntry {
    pub fn maybe_frequency(&self) -> Option<FrequencyUnion> {
        if let TermMetaData::Frequency(freq) = &self.data {
            match freq {
                FrequencyData::SimpleNumber(num) => Some(FrequencyUnion {
                    value: Some(*num),
                    display_value: None,
                    reading: None,
                }),
                FrequencyData::SimpleString(s) => Some(FrequencyUnion {
                    value: None,
                    display_value: Some(s.clone()),
                    reading: None,
                }),
                FrequencyData::Detailed(details) => Some(FrequencyUnion {
                    value: None,
                    display_value: details.display_value.clone(),
                    reading: details.reading.clone(),
                }),
            }
        } else {
            None
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum TermMetaData {
    Frequency(FrequencyData),
    Pitch(PitchData),
    Ipa(IPAData),
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(untagged)]
pub enum FrequencyData {
    SimpleNumber(i32),
    SimpleString(String),
    Detailed(FrequencyDetails),
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FrequencyDetails {
    pub value: Option<f64>,
    pub display_value: Option<String>,
    pub reading: Option<String>,
    pub frequency: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct PitchData {
    pub reading: String,
    pub pitches: Vec<PitchInfo>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct PitchInfo {
    pub position: i32,
    pub nasal: Option<serde_json::Value>, // Can be integer or array
    pub devoice: Option<serde_json::Value>, // Can be integer or array
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct IPAData {
    pub reading: String,
    pub transcriptions: Vec<IPATranscription>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct IPATranscription {
    pub ipa: String,
    pub tags: Vec<String>,
}

impl<'de> Deserialize<'de> for TermMetaEntry {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct TermMetaEntryVisitor;

        impl<'de> Visitor<'de> for TermMetaEntryVisitor {
            type Value = TermMetaEntry;

            fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
                formatter.write_str("a sequence of (term, type, data)")
            }

            fn visit_seq<V>(self, mut seq: V) -> Result<TermMetaEntry, V::Error>
            where
                V: SeqAccess<'de>,
            {
                let term: String = seq
                    .next_element()?
                    .ok_or_else(|| de::Error::invalid_length(0, &self))?;
                let entry_type: String = seq
                    .next_element()?
                    .ok_or_else(|| de::Error::invalid_length(1, &self))?;
                let data: TermMetaData = match entry_type.as_ref() {
                    "freq" => {
                        let freq_data: serde_json::Value = seq
                            .next_element()?
                            .ok_or_else(|| de::Error::invalid_length(2, &self))?;
                        TermMetaData::Frequency(
                            serde_json::from_value(freq_data)
                                .map_err(|_| de::Error::custom("invalid frequency data"))?,
                        )
                    }
                    "pitch" => {
                        let pitch_data: PitchData = seq
                            .next_element()?
                            .ok_or_else(|| de::Error::invalid_length(2, &self))?;
                        TermMetaData::Pitch(pitch_data)
                    }
                    "ipa" => {
                        let ipa_data: IPAData = seq
                            .next_element()?
                            .ok_or_else(|| de::Error::invalid_length(2, &self))?;
                        TermMetaData::Ipa(ipa_data)
                    }
                    _ => {
                        return Err(de::Error::unknown_field(
                            &entry_type,
                            &["freq", "pitch", "ipa"],
                        ))
                    }
                };

                Ok(TermMetaEntry {
                    term,
                    entry_type,
                    data,
                })
            }
        }

        deserializer.deserialize_seq(TermMetaEntryVisitor)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::fs;

    #[test]
    fn test_valid_term_meta_bank() {
        let json_str =
            fs::read_to_string("data/dictionaries/valid-dictionary1/term_meta_bank_1.json")
                .expect("Failed to read term_meta_bank_1.json");

        let meta_bank: Vec<TermMetaEntry> =
            serde_json::from_str(&json_str).expect("Failed to parse term_meta_bank_1.json");

        // Entry 0 to 6
        assert_eq!(meta_bank[0].term, "打");
        match &meta_bank[0].data {
            TermMetaData::Frequency(FrequencyData::SimpleNumber(num)) => assert_eq!(*num, 1),
            _ => panic!("Expected simple number frequency for entry 0"),
        }

        assert_eq!(meta_bank[1].term, "打つ");
        match &meta_bank[1].data {
            TermMetaData::Frequency(FrequencyData::SimpleNumber(num)) => assert_eq!(*num, 2),
            _ => panic!("Expected simple number frequency for entry 1"),
        }

        assert_eq!(meta_bank[2].term, "打ち込む");
        match &meta_bank[2].data {
            TermMetaData::Frequency(FrequencyData::SimpleNumber(num)) => assert_eq!(*num, 3),
            _ => panic!("Expected simple number frequency for entry 2"),
        }

        assert_eq!(meta_bank[3].term, "打");
        match &meta_bank[3].data {
            TermMetaData::Frequency(FrequencyData::SimpleString(s)) => assert_eq!(s, "four"),
            _ => panic!("Expected simple string frequency for entry 3"),
        }

        assert_eq!(meta_bank[4].term, "打");
        match &meta_bank[4].data {
            TermMetaData::Frequency(FrequencyData::SimpleString(s)) => assert_eq!(s, "five (5)"),
            _ => panic!("Expected simple string frequency for entry 4"),
        }

        assert_eq!(meta_bank[5].term, "打つ");
        match &meta_bank[5].data {
            TermMetaData::Frequency(FrequencyData::Detailed(details)) => {
                assert_eq!(details.value.unwrap(), 6.0);
                assert!(details.display_value.is_none());
            }
            _ => panic!("Expected detailed frequency for entry 5"),
        }

        assert_eq!(meta_bank[6].term, "打ち込む");
        match &meta_bank[6].data {
            TermMetaData::Frequency(FrequencyData::Detailed(details)) => {
                assert_eq!(details.value.unwrap(), 7.0);
                assert_eq!(details.display_value.as_ref().unwrap(), "seven");
            }
            _ => panic!("Expected detailed frequency for entry 6"),
        }

        // Entry 7 to 12

        assert_eq!(meta_bank[7].term, "打");
        match &meta_bank[7].data {
            TermMetaData::Frequency(FrequencyData::Detailed(details)) => {
                assert_eq!(details.reading.as_ref().unwrap(), "だ");
                assert_eq!(details.frequency.as_ref().unwrap(), 8.0);
            }
            _ => panic!("Expected detailed frequency for entry 7"),
        }

        assert_eq!(meta_bank[8].term, "打");
        match &meta_bank[8].data {
            TermMetaData::Frequency(FrequencyData::Detailed(details)) => {
                assert_eq!(details.reading.as_ref().unwrap(), "ダース");
                assert_eq!(details.frequency.as_ref().unwrap(), 9.0);
            }
            _ => panic!("Expected detailed frequency for entry 8"),
        }

        assert_eq!(meta_bank[9].term, "打つ");
        match &meta_bank[9].data {
            TermMetaData::Frequency(FrequencyData::Detailed(details)) => {
                assert_eq!(details.reading.as_ref().unwrap(), "うつ");
                assert_eq!(details.frequency.as_ref().unwrap(), 10.0);
            }
            _ => panic!("Expected detailed frequency for entry 9"),
        }

        assert_eq!(meta_bank[10].term, "打つ");
        match &meta_bank[10].data {
            TermMetaData::Frequency(FrequencyData::Detailed(details)) => {
                assert_eq!(details.reading.as_ref().unwrap(), "ぶつ");
                assert_eq!(details.frequency.as_ref().unwrap(), 11.0);
            }
            _ => panic!("Expected detailed frequency for entry 10"),
        }

        assert_eq!(meta_bank[11].term, "打ち込む");
        match &meta_bank[11].data {
            TermMetaData::Frequency(FrequencyData::Detailed(details)) => {
                assert_eq!(details.reading.as_ref().unwrap(), "うちこむ");
                assert_eq!(details.frequency.as_ref().unwrap(), 12.0);
            }
            _ => panic!("Expected detailed frequency for entry 11"),
        }

        assert_eq!(meta_bank[12].term, "打ち込む");
        match &meta_bank[12].data {
            TermMetaData::Frequency(FrequencyData::Detailed(details)) => {
                assert_eq!(details.reading.as_ref().unwrap(), "ぶちこむ");
                assert_eq!(details.frequency.as_ref().unwrap(), 13.0);
            }
            _ => panic!("Expected detailed frequency for entry 12"),
        }

        // Entry 13 to 18

        assert_eq!(meta_bank[13].term, "打");
        match &meta_bank[13].data {
            TermMetaData::Frequency(FrequencyData::Detailed(details)) => {
                assert_eq!(details.reading.as_ref().unwrap(), "だ");
                assert_eq!(details.frequency.as_ref().unwrap(), "fourteen");
            }
            _ => panic!("Expected detailed frequency for entry 13"),
        }

        assert_eq!(meta_bank[14].term, "打");
        match &meta_bank[14].data {
            TermMetaData::Frequency(FrequencyData::Detailed(details)) => {
                assert_eq!(details.reading.as_ref().unwrap(), "ダース");
                assert_eq!(details.frequency.as_ref().unwrap(), "fifteen");
            }
            _ => panic!("Expected detailed frequency for entry 14"),
        }

        assert_eq!(meta_bank[15].term, "打つ");
        match &meta_bank[15].data {
            TermMetaData::Frequency(FrequencyData::Detailed(details)) => {
                assert_eq!(details.reading.as_ref().unwrap(), "うつ");
                assert_eq!(details.frequency.as_ref().unwrap(), "sixteen");
            }
            _ => panic!("Expected detailed frequency for entry 15"),
        }

        assert_eq!(meta_bank[16].term, "打つ");
        match &meta_bank[16].data {
            TermMetaData::Frequency(FrequencyData::Detailed(details)) => {
                assert_eq!(details.reading.as_ref().unwrap(), "ぶつ");
                assert_eq!(details.frequency.as_ref().unwrap(), "seventeen");
            }
            _ => panic!("Expected detailed frequency for entry 16"),
        }

        assert_eq!(meta_bank[17].term, "打ち込む");
        match &meta_bank[17].data {
            TermMetaData::Frequency(FrequencyData::Detailed(details)) => {
                assert_eq!(details.reading.as_ref().unwrap(), "うちこむ");
                assert_eq!(details.frequency.as_ref().unwrap(), "eighteen");
            }
            _ => panic!("Expected detailed frequency for entry 17"),
        }

        assert_eq!(meta_bank[18].term, "打ち込む");
        match &meta_bank[18].data {
            TermMetaData::Frequency(FrequencyData::Detailed(details)) => {
                assert_eq!(details.reading.as_ref().unwrap(), "ぶちこむ");
                assert_eq!(details.frequency.as_ref().unwrap(), "nineteen");
            }
            _ => panic!("Expected detailed frequency for entry 18"),
        }

        // Entry 19 to 24

        assert_eq!(meta_bank[19].term, "打");
        match &meta_bank[19].data {
            TermMetaData::Frequency(FrequencyData::Detailed(details)) => {
                assert_eq!(details.reading.as_ref().unwrap(), "だ");
                assert_eq!(details.frequency.as_ref().unwrap(), "twenty (20)");
            }
            _ => panic!("Expected detailed frequency for entry 19"),
        }

        assert_eq!(meta_bank[20].term, "打");
        match &meta_bank[20].data {
            TermMetaData::Frequency(FrequencyData::Detailed(details)) => {
                assert_eq!(details.reading.as_ref().unwrap(), "ダース");
                assert_eq!(details.frequency.as_ref().unwrap(), "twenty-one (21)");
            }
            _ => panic!("Expected detailed frequency for entry 20"),
        }

        assert_eq!(meta_bank[21].term, "打つ");
        match &meta_bank[21].data {
            TermMetaData::Frequency(FrequencyData::Detailed(details)) => {
                assert_eq!(details.reading.as_ref().unwrap(), "うつ");
                assert_eq!(details.frequency.as_ref().unwrap(), "twenty-two (22)");
            }
            _ => panic!("Expected detailed frequency for entry 21"),
        }

        assert_eq!(meta_bank[22].term, "打つ");
        match &meta_bank[22].data {
            TermMetaData::Frequency(FrequencyData::Detailed(details)) => {
                assert_eq!(details.reading.as_ref().unwrap(), "ぶつ");
                assert_eq!(details.frequency.as_ref().unwrap(), "twenty-three (23)");
            }
            _ => panic!("Expected detailed frequency for entry 22"),
        }

        assert_eq!(meta_bank[23].term, "打ち込む");
        match &meta_bank[23].data {
            TermMetaData::Frequency(FrequencyData::Detailed(details)) => {
                assert_eq!(details.reading.as_ref().unwrap(), "うちこむ");
                assert_eq!(details.frequency.as_ref().unwrap(), "twenty-four (24)");
            }
            _ => panic!("Expected detailed frequency for entry 23"),
        }

        assert_eq!(meta_bank[24].term, "打ち込む");
        match &meta_bank[24].data {
            TermMetaData::Frequency(FrequencyData::Detailed(details)) => {
                assert_eq!(details.reading.as_ref().unwrap(), "ぶちこむ");
                assert_eq!(details.frequency.as_ref().unwrap(), "twenty-five (25)");
            }
            _ => panic!("Expected detailed frequency for entry 24"),
        }

        // Entry 25 to 30

        assert_eq!(meta_bank[25].term, "打");
        match &meta_bank[25].data {
            TermMetaData::Frequency(FrequencyData::Detailed(details)) => {
                assert_eq!(details.reading.as_ref().unwrap(), "だ");
                assert_eq!(details.frequency.clone().unwrap(), json!({"value": 26}));
            }
            _ => panic!("Expected detailed frequency for entry 25"),
        }

        assert_eq!(meta_bank[26].term, "打");
        match &meta_bank[26].data {
            TermMetaData::Frequency(FrequencyData::Detailed(details)) => {
                assert_eq!(details.reading.as_ref().unwrap(), "ダース");
                assert_eq!(
                    details.frequency.clone().unwrap(),
                    json!({"value": 27, "displayValue": "twenty-seven"})
                );
            }
            _ => panic!("Expected detailed frequency for entry 26"),
        }

        assert_eq!(meta_bank[27].term, "打つ");
        match &meta_bank[27].data {
            TermMetaData::Frequency(FrequencyData::Detailed(details)) => {
                assert_eq!(details.reading.as_ref().unwrap(), "うつ");
                assert_eq!(details.frequency.clone().unwrap(), json!({"value": 28}));
            }
            _ => panic!("Expected detailed frequency for entry 27"),
        }

        assert_eq!(meta_bank[28].term, "打つ");
        match &meta_bank[28].data {
            TermMetaData::Frequency(FrequencyData::Detailed(details)) => {
                assert_eq!(details.reading.as_ref().unwrap(), "ぶつ");
                assert_eq!(
                    details.frequency.clone().unwrap(),
                    json!({"value": 29, "displayValue": "twenty-nine"})
                );
            }
            _ => panic!("Expected detailed frequency for entry 28"),
        }

        assert_eq!(meta_bank[29].term, "打ち込む");
        match &meta_bank[29].data {
            TermMetaData::Frequency(FrequencyData::Detailed(details)) => {
                assert_eq!(details.reading.as_ref().unwrap(), "うちこむ");
                assert_eq!(details.frequency.clone().unwrap(), json!({"value": 30}));
            }
            _ => panic!("Expected detailed frequency for entry 29"),
        }

        assert_eq!(meta_bank[30].term, "打ち込む");
        match &meta_bank[30].data {
            TermMetaData::Frequency(FrequencyData::Detailed(details)) => {
                assert_eq!(details.reading.as_ref().unwrap(), "ぶちこむ");
                assert_eq!(
                    details.frequency.clone().unwrap(),
                    json!({"value": 31, "displayValue": "thirty-one"})
                );
            }
            _ => panic!("Expected detailed frequency for entry 30"),
        }

        // Entry 31 to 36

        assert_eq!(meta_bank[31].term, "打ち込む");
        match &meta_bank[31].data {
            TermMetaData::Pitch(PitchData { reading, pitches }) => {
                assert_eq!(reading, "うちこむ");
                assert_eq!(pitches.len(), 2);
                assert_eq!(pitches[0].position, 0);
                assert_eq!(pitches[1].position, 3);
            }
            _ => panic!("Expected pitch data for entry 31"),
        }

        assert_eq!(meta_bank[32].term, "打ち込む");
        match &meta_bank[32].data {
            TermMetaData::Pitch(PitchData { reading, pitches }) => {
                assert_eq!(reading, "ぶちこむ");
                assert_eq!(pitches.len(), 2);
                assert_eq!(pitches[0].position, 0);
                assert_eq!(pitches[1].position, 3);
            }
            _ => panic!("Expected pitch data for entry 32"),
        }

        assert_eq!(meta_bank[33].term, "お手前");
        match &meta_bank[33].data {
            TermMetaData::Pitch(PitchData { reading, pitches }) => {
                assert_eq!(reading, "おてまえ");
                assert_eq!(pitches.len(), 3);
                assert_eq!(pitches[0].position, 2);
                assert_eq!(pitches[0].tags.clone().unwrap(), vec!["P1"]);
                assert_eq!(pitches[1].position, 2);
                assert_eq!(pitches[1].tags.clone().unwrap(), vec!["P2"]);
                assert_eq!(pitches[2].position, 0);
                assert_eq!(pitches[2].tags.clone().unwrap(), vec!["P2"]);
            }
            _ => panic!("Expected pitch data for entry 33"),
        }

        assert_eq!(meta_bank[34].term, "番号");
        match &meta_bank[34].data {
            TermMetaData::Pitch(PitchData { reading, pitches }) => {
                assert_eq!(reading, "ばんごう");
                assert_eq!(pitches.len(), 1);
                assert_eq!(pitches[0].position, 3);
                assert_eq!(pitches[0].nasal.clone().unwrap(), 3);
            }
            _ => panic!("Expected pitch data for entry 34"),
        }

        assert_eq!(meta_bank[35].term, "中腰");
        match &meta_bank[35].data {
            TermMetaData::Pitch(PitchData { reading, pitches }) => {
                assert_eq!(reading, "ちゅうごし");
                assert_eq!(pitches.len(), 1);
                assert_eq!(pitches[0].position, 0);
                assert_eq!(pitches[0].nasal.clone().unwrap(), 3);
            }
            _ => panic!("Expected pitch data for entry 35"),
        }

        assert_eq!(meta_bank[36].term, "所業");
        match &meta_bank[36].data {
            TermMetaData::Pitch(PitchData { reading, pitches }) => {
                assert_eq!(reading, "しょぎょう");
                assert_eq!(pitches.len(), 1);
                assert_eq!(pitches[0].position, 0);
                assert_eq!(pitches[0].nasal.clone().unwrap(), 2);
            }
            _ => panic!("Expected pitch data for entry 36"),
        }

        assert_eq!(meta_bank[37].term, "土木工事");
        match &meta_bank[37].data {
            TermMetaData::Pitch(PitchData { reading, pitches }) => {
                assert_eq!(reading, "どぼくこうじ");
                assert_eq!(pitches.len(), 1);
                assert_eq!(pitches[0].position, 4);
                assert_eq!(pitches[0].devoice.clone().unwrap(), 3);
            }
            _ => panic!("Expected pitch data for entry 37"),
        }

        assert_eq!(meta_bank[38].term, "好き");
        match &meta_bank[38].data {
            TermMetaData::Ipa(IPAData {
                reading,
                transcriptions,
            }) => {
                assert_eq!(reading, "すき");
                assert_eq!(transcriptions.len(), 1);
                assert_eq!(transcriptions[0].ipa, "[sɨᵝkʲi]");
                assert_eq!(transcriptions[0].tags, vec!["東京"]);
            }
            _ => panic!("Expected ipa data for entry 38"),
        }
    }
}
