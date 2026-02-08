use std::collections::{HashMap, HashSet};
use std::io::Read;
use std::sync::Arc;

use crate::user_preferences::UserPreferences;
use anyhow::{Context, Error, Result};
use camino::{Utf8Path as Path, Utf8PathBuf as PathBuf};
use tokio::task::JoinSet;
use tracing::{debug, error, info, instrument, trace, warn};
use wana_kana::{ConvertJapanese, IsJapaneseStr};
use yomitan_format::json_schema::index::DictionaryIndex;
use yomitan_format::json_schema::kanji_bank_v3::{KanjiBankV3, KanjiEntry};
use yomitan_format::json_schema::kanji_meta_bank_v3::KanjiMetaBankV3;
use yomitan_format::json_schema::tag_bank_v3::TagBankV3;
use yomitan_format::json_schema::term_bank_v3::{TermBankV3, TermEntry};
use yomitan_format::json_schema::term_meta_bank_v3::{
    PitchData, TermMetaBankV3, TermMetaData, TermMetaEntry,
};
use yomitan_format::kv_store::db::DictionaryDB;
use yomitan_format::NormalizedPathBuf;

use crate::mecab::TokenFeature;
use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
pub struct DictionaryInfo {
    pub title: String,
    pub revision: String,
    pub dictionary_type: DictionaryType,
}

pub struct LookupResult {
    pub dict: Vec<DictionaryResult>,
    // dictionary_result.entries[i].text -> reading -> PitchResult
    pub pitch: HashMap<String, HashMap<String, PitchResult>>,
    pub freq: HashMap<String, Vec<FrequencyData>>,
}

#[derive(Debug)]
pub struct DictionaryResult {
    pub title: String,
    pub revision: String,
    pub origin: String,
    pub entries: Vec<TermEntry>,
}

#[derive(Debug)]
pub struct PitchResult {
    pub title: String,
    pub pitch_accents: PitchAccents,
}

#[derive(Debug)]
pub struct FrequencyData {
    pub term: String,
    pub reading: Option<String>,
    pub value: Option<i32>,
    pub display_value: Option<String>,
}

#[derive(Debug, Eq, PartialEq, Clone, Serialize)]
pub enum DictionaryType {
    Term,
    Pitch,
    Frequency,
    Kanji,
}

pub struct YomitanTermDictionary(pub YomitanDictionary);
pub struct YomitanPitchDictionary(pub YomitanDictionary);
pub struct YomitanFrequencyDictionary(pub YomitanDictionary);
pub struct YomitanKanjiDictionary(pub YomitanDictionary);

#[derive(Clone)]
pub struct YomitanDictionaries {
    terms: Vec<Arc<YomitanTermDictionary>>,
    // TODO: Support multiple pitch dictionaries
    pitch: Vec<Arc<YomitanPitchDictionary>>,
    // TODO: Support multiple frequency dictionaries
    freq: Vec<Arc<YomitanFrequencyDictionary>>,
    kanji: Vec<Arc<YomitanKanjiDictionary>>,
}

impl YomitanDictionaries {
    #[instrument]
    pub fn new(dict_dir: &Path) -> Result<Self, Error> {
        let mut terms = Vec::new();
        let mut freq = Vec::new();
        let mut pitch = Vec::new();
        let mut kanji = Vec::new();

        if dict_dir.exists() {
            // Loop over all directories in the given path
            for dict_path in dict_dir
                .read_dir()
                .context("Failed to read dictionary directory")?
            {
                if let Ok(dict_path) = dict_path {
                    if dict_path.path().is_dir() {
                        trace!("🔍 Loading dictionary from: {}", dict_path.path().display());
                        let dict_path = PathBuf::try_from(dict_path.path())?;
                        // Load the dictionary and identify its type
                        let dict = YomitanDictionary::new(&dict_path)?;
                        if let Ok(dict_type) = dict.identify_dictionary_type() {
                            info!(
                                title = %dict.index.title,
                                revision = %dict.index.revision,
                                type_name = ?dict_type,
                                "🔍 Successfully loaded dictionary"
                            );
                            match dict_type {
                                DictionaryType::Term => {
                                    terms.push(Arc::new(YomitanTermDictionary(dict)))
                                }
                                DictionaryType::Pitch => {
                                    pitch.push(Arc::new(YomitanPitchDictionary(dict)))
                                }
                                DictionaryType::Frequency => {
                                    freq.push(Arc::new(YomitanFrequencyDictionary(dict)))
                                }
                                DictionaryType::Kanji => {
                                    kanji.push(Arc::new(YomitanKanjiDictionary(dict)))
                                }
                            }
                        } else {
                            warn!(?dict_path, "Failed to identify dictionary type",);
                        }
                    }
                } else {
                    warn!("Skipping non-directory entry");
                }
            }
        } else {
            info!("Dictionary directory does not exist, creating");
            std::fs::create_dir_all(dict_dir).map_err(|e| {
                error!(?e, "Failed to create dictionary directory");
                anyhow::anyhow!("Failed to create dictionary directory {dict_dir}: {e}")
            })?;
        }

        info!(
            term_count = %terms.len(),
            freq_count = %freq.len(),
            pitch_count = %pitch.len(),
            kanji_count = %kanji.len(),
            total_count = %(&terms.len() + &freq.len() + &pitch.len() + &kanji.len()),
            "Dictionary loading complete"
        );

        Ok(YomitanDictionaries {
            terms,
            freq,
            pitch,
            kanji,
        })
    }

    pub fn register_dictionary(&mut self, dict_path: NormalizedPathBuf) -> Result<(), Error> {
        let dict = YomitanDictionary::new(&dict_path.path)?;
        let dict_type = dict.identify_dictionary_type()?;
        // Check if a dictionary with the same title and revision already exists
        if self.terms.iter().any(|d| {
            d.0.index.title == dict.index.title && d.0.index.revision == dict.index.revision
        }) {
            error!(
                "Dictionary with title {} and revision {} already exists",
                dict.index.title, dict.index.revision
            );
            return Err(anyhow::anyhow!(
                "Dictionary with title {} and revision {} already exists",
                dict.index.title,
                dict.index.revision
            ));
        }
        info!(
            "🔍 Successfully registering new dictionary: {} with type {:?}",
            dict.index.title, dict_type
        );
        match dict_type {
            DictionaryType::Term => self.terms.push(Arc::new(YomitanTermDictionary(dict))),
            DictionaryType::Frequency => self.freq.push(Arc::new(YomitanFrequencyDictionary(dict))),
            DictionaryType::Pitch => self.pitch.push(Arc::new(YomitanPitchDictionary(dict))),
            DictionaryType::Kanji => self.kanji.push(Arc::new(YomitanKanjiDictionary(dict))),
        }
        Ok(())
    }

    #[tracing::instrument(skip(self, token_features, user_preferences), fields(surface_forms = ?token_features.iter().map(|t| &t.surface_form).collect::<Vec<_>>(), dictionary_title = self.terms[0].0.index.title.clone()))]
    pub async fn lookup(
        &self,
        token_features: &Vec<TokenFeature>,
        user_preferences: &UserPreferences,
    ) -> Result<LookupResult> {
        let dict_results = {
            let mut join_set = JoinSet::new();

            // Spawn tasks for all dictionary lookups
            let mut filtered_dicts_count = 0;
            for dict in self.terms.iter() {
                let dict = dict.clone();
                let dict_title = dict.0.index.title.clone();
                let dict_revision = dict.0.index.revision.clone();
                if !user_preferences
                    .term_disabled_dictionaries
                    .contains(&format!("{dict_title}#{dict_revision}"))
                {
                    let token_features = token_features.clone();
                    join_set.spawn(async move { (dict_title, dict.lookup(&token_features)) });
                } else {
                    filtered_dicts_count += 1;
                }
            }
            if filtered_dicts_count > 0 {
                info!(
                    ?filtered_dicts_count,
                    "🔍 Filtered out dictionaries during term lookup"
                );
            }

            // Collect results
            let mut dict_results = Vec::new();
            while let Some(result) = join_set.join_next().await {
                let (dict_title, result) = match result {
                    Ok((dict_title, result)) => (dict_title, result),
                    Err(e) => {
                        warn!(?e, "(1) Error joining dictionary lookup task, skipping");
                        continue;
                    }
                };
                let result = match result {
                    Ok(result) => result,
                    Err(e) => {
                        warn!(
                            ?e,
                            ?dict_title,
                            "(2) Error joining dictionary lookup task, skipping"
                        );
                        continue;
                    }
                };
                if result.entries.is_empty() {
                    trace!("🔍 Skipping empty dictionary result: {}", dict_title);
                    continue;
                }
                dict_results.push(result);
            }
            dict_results
        };

        let mut pitch_results: HashMap<String, HashMap<String, PitchResult>> = HashMap::new();

        // Make a Set of all the terms+readings combinations we've found
        let mut term_readings = HashSet::new();
        for d in dict_results.iter() {
            for entry in d.entries.iter() {
                term_readings.insert((entry.text.clone(), entry.reading.clone()));
            }
        }

        for (term, reading) in term_readings.iter() {
            if let Some(pitch_entry) = self.pitch[0].lookup(term, reading)? {
                let pitch_accents = PitchAccents::from(&pitch_entry);
                pitch_results
                    .entry(term.clone())
                    .or_insert(HashMap::new())
                    .insert(
                        reading.clone(),
                        PitchResult {
                            title: self.pitch[0].0.index.title.clone(),
                            pitch_accents,
                        },
                    );
            }
        }

        trace!("🔍 Pitch results: {pitch_results:?}");

        let mut filtered_dict_count: i32 = 0;
        let mut freq_res: HashMap<String, Vec<FrequencyData>> = HashMap::new();
        for freq_dict in self.freq.iter() {
            let dict_title = freq_dict.0.index.title.clone();
            let dict_revision = freq_dict.0.index.revision.clone();
            if !user_preferences
                .freq_disabled_dictionaries
                .contains(&format!("{dict_title}#{dict_revision}"))
            {
                let single_dict_freq_results = freq_dict.lookup_terms(token_features)?;
                // Convert frequency results to FrequencyData format
                let freq_data: Vec<FrequencyData> = single_dict_freq_results
                    .iter()
                    .filter_map(|entry| {
                        let freq_union = entry.maybe_frequency();
                        if let Some(freq_union) = freq_union {
                            Some(FrequencyData {
                                term: entry.term.clone(),
                                reading: freq_union.reading.clone(),
                                value: freq_union.value,
                                display_value: freq_union.display_value,
                            })
                        } else {
                            None
                        }
                    })
                    .collect();
                freq_res.insert(
                    format!("{}#{}", freq_dict.0.index.title, freq_dict.0.index.revision),
                    freq_data,
                );
            } else {
                filtered_dict_count += 1;
            }
        }
        if filtered_dict_count > 0 {
            info!(
                ?filtered_dict_count,
                "🔍 Filtered out dictionaries during frequency lookup"
            );
        }

        trace!("🔍 Frequency results: {:?}", freq_res);

        Ok(LookupResult {
            dict: dict_results,
            pitch: pitch_results,
            freq: freq_res,
        })
    }

    pub fn get_dictionaries_info(&self) -> Vec<DictionaryInfo> {
        let mut dictionary_infos: Vec<DictionaryInfo> = Vec::new();
        dictionary_infos.extend(
            self.terms
                .iter()
                .map(|d| DictionaryInfo {
                    title: d.0.index.title.clone(),
                    revision: d.0.index.revision.clone(),
                    dictionary_type: DictionaryType::Term,
                })
                .collect::<Vec<DictionaryInfo>>(),
        );
        dictionary_infos.extend(
            self.pitch
                .iter()
                .map(|d| DictionaryInfo {
                    title: d.0.index.title.clone(),
                    revision: d.0.index.revision.clone(),
                    dictionary_type: DictionaryType::Pitch,
                })
                .collect::<Vec<DictionaryInfo>>(),
        );
        dictionary_infos.extend(
            self.freq
                .iter()
                .map(|d| DictionaryInfo {
                    title: d.0.index.title.clone(),
                    revision: d.0.index.revision.clone(),
                    dictionary_type: DictionaryType::Frequency,
                })
                .collect::<Vec<DictionaryInfo>>(),
        );
        dictionary_infos.extend(
            self.kanji
                .iter()
                .map(|d| DictionaryInfo {
                    title: d.0.index.title.clone(),
                    revision: d.0.index.revision.clone(),
                    dictionary_type: DictionaryType::Kanji,
                })
                .collect::<Vec<DictionaryInfo>>(),
        );
        dictionary_infos
    }

    pub fn clear(&mut self) {
        self.terms.clear();
        self.pitch.clear();
        self.freq.clear();
        self.kanji.clear();
        debug!("Cleared content of yomi_dicts");
    }
}

pub struct YomitanDictionary {
    pub origin: String,
    pub index: DictionaryIndex,
    pub kanji_bank: Option<DictionaryDB<KanjiBankV3>>,
    pub kanji_meta_bank: Option<DictionaryDB<KanjiMetaBankV3>>,
    pub tag_bank: Option<DictionaryDB<TagBankV3>>,
    pub term_bank: Option<DictionaryDB<TermBankV3>>,
    pub term_meta_bank: Option<DictionaryDB<TermMetaBankV3>>,
}

impl YomitanDictionary {
    fn new(dict_path: &Path) -> Result<Self, Error> {
        let origin = dict_path
            .file_name()
            .expect(&format!(
                "Expected dictionary path to have file name component: {dict_path}"
            ))
            .to_string();

        let index: DictionaryIndex = {
            let mut index_str = String::new();
            std::fs::File::open(format!("{dict_path}/index.json"))?
                .read_to_string(&mut index_str)?;
            serde_json::from_str(&index_str)?
        };

        let kanji_bank = DictionaryDB::<KanjiBankV3>::open_ro(dict_path)?;

        let kanji_meta_bank = DictionaryDB::<KanjiMetaBankV3>::open_ro(dict_path)?;

        let tag_bank: Option<DictionaryDB<TagBankV3>> =
            DictionaryDB::<TagBankV3>::open_ro(dict_path)?;

        let term_bank = DictionaryDB::<TermBankV3>::open_ro(dict_path)?;

        let term_meta_bank = DictionaryDB::<TermMetaBankV3>::open_ro(dict_path)?;

        Ok(Self {
            origin,
            index,
            kanji_bank,
            kanji_meta_bank,
            tag_bank,
            term_bank,
            term_meta_bank,
        })
    }

    pub fn identify_dictionary_type(&self) -> Result<DictionaryType> {
        // - Term dictionaries have a non-empty term_bank
        // - Pitch/frequency dictionaries have a non-empty term_meta_bank and empty term_bank
        //   (need to check the data in term_meta_bank to distinguish between pitch and frequency)
        // - Kanji dictionaries have a non-empty kanji_bank

        let term_bank: Option<i64> = match &self.term_bank {
            Some(db) => Some(db.get_num_rows()?),
            None => None,
        };

        let term_meta_bank: Option<i64> = match &self.term_meta_bank {
            Some(db) => Some(db.get_num_rows()?),
            None => None,
        };

        let kanji_bank: Option<i64> = match &self.kanji_bank {
            Some(db) => Some(db.get_num_rows()?),
            None => None,
        };

        if kanji_bank > Some(0) || self.index.revision.contains("kanji") {
            Ok(DictionaryType::Kanji)
        } else if term_meta_bank > Some(0) {
            // Have to distinguish based on the data in the term_meta_bank
            let first_row = self
                .term_meta_bank
                .as_ref()
                .expect("Term meta bank not found")
                .get_first_row()?;
            if let Some(first_row) = first_row {
                let entry: Vec<TermMetaEntry> = serde_json::from_str(&first_row)?;
                let first_entry = entry
                    .first()
                    .expect(&format!("Term meta bank is empty for {}", self.index.title));
                if let TermMetaData::Frequency(_) = &first_entry.data {
                    Ok(DictionaryType::Frequency)
                } else if let TermMetaData::Pitch(_) = &first_entry.data {
                    Ok(DictionaryType::Pitch)
                } else {
                    Err(anyhow::anyhow!(
                        "(1) Unsupported dictionary type for {}",
                        self.index.title
                    ))
                }
            } else {
                Err(anyhow::anyhow!("Term meta bank is empty"))
            }
        } else if term_bank > Some(0) {
            Ok(DictionaryType::Term)
        } else {
            error!("Unsupported dictionary type for {}", self.index.title);
            Err(anyhow::anyhow!(
                "(2) Unsupported dictionary type for {}",
                self.index.title
            ))?
        }
    }
}

impl YomitanTermDictionary {
    #[tracing::instrument(skip(self, token_features), fields(surface_forms = ?token_features.iter().map(|t| &t.surface_form).collect::<Vec<_>>(), dictionary_title = self.0.index.title.clone()))]
    fn lookup(&self, token_features: &Vec<TokenFeature>) -> Result<DictionaryResult> {
        let mut results = Vec::new();

        trace!("📝 Search order:");
        for (index, feature) in token_features.iter().enumerate() {
            trace!("🔎 Search attempt #{}", index + 1);

            // Try surface form first
            if let Some(surface) = &feature.surface_form {
                trace!("  ▶️ Searching surface form: '{}'... ", surface);
                // Try original form
                if let Some(entries) = self.lookup_term(surface.clone())? {
                    trace!("✅ Found!");
                    results.extend(entries);
                } else {
                    // If it's katakana, try converting to hiragana
                    if surface.as_str().is_katakana() {
                        let hiragana = surface.to_hiragana();
                        trace!("  ▶️ Searching hiragana form: '{}'... ", hiragana);
                        if let Some(entries) = self.lookup_term(hiragana)? {
                            trace!("✅ Found!");
                            results.extend(entries);
                        } else {
                            trace!("❌ Not found");
                        }
                    } else {
                        trace!("❌ Not found");
                    }
                }
            }

            // Try dictionary form if different
            if let Some(dict_form) = &feature.dictionary_form {
                if Some(dict_form) != feature.surface_form.as_ref() {
                    trace!("  ▶️ Searching dictionary form: '{}'... ", dict_form);
                    match self.lookup_term(dict_form.clone())? {
                        Some(entries) => {
                            trace!("✅ Found!");
                            results.extend(entries);
                        }
                        None => trace!("❌ Not found"),
                    }
                }
            }

            // Print full token info for debugging
            trace!("   Token details:");
            trace!("     Surface form: {:?}", feature.surface_form);
            trace!("     Dictionary form: {:?}", feature.dictionary_form);
            trace!("     Part of speech: {:?}", feature.pos);
            if feature.pos_subtype_1.is_some() {
                trace!("     POS subtype: {:?}", feature.pos_subtype_1);
            }
        }
        Ok(DictionaryResult {
            title: self.0.index.title.clone(),
            revision: self.0.index.revision.clone(),
            origin: self.0.origin.clone(),
            entries: results,
        })
    }

    #[tracing::instrument(skip(self), fields(dictionary_title = self.0.index.title.clone()))]
    fn lookup_term(&self, term: String) -> Result<Option<Vec<TermEntry>>> {
        let res = self
            .0
            .term_bank
            .as_ref()
            .expect("Term bank not found")
            .get(&term)?;
        if let Some(res) = res {
            trace!("📖 Raw JSON for term '{}': {}", term, res);

            let entries = match serde_json::from_str::<Vec<TermEntry>>(&res) {
                Ok(entries) => {
                    trace!(
                        "✅ Successfully deserialized {} entries for term '{}'",
                        entries.len(),
                        term
                    );
                    entries
                }
                Err(e) => {
                    error!(
                        error = %e,
                        raw_json = %res,
                        term = %term,
                        "❌ Deserialization failed for term. Raw JSON above."
                    );
                    // Try to deserialize as serde_json::Value to inspect the structure
                    if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(&res) {
                        debug!(
                            "📋 JSON structure: {}",
                            serde_json::to_string_pretty(&json_value)?
                        );
                        if json_value.is_array() {
                            for (idx, item) in json_value.as_array().unwrap().iter().enumerate() {
                                debug!("  Entry[{}]: {:?}", idx, item);
                                if let Some(obj) = item.as_array() {
                                    debug!("    Length: {}", obj.len());
                                    for (field_idx, field) in obj.iter().enumerate() {
                                        if field.is_null() {
                                            warn!("    Field[{}] is NULL", field_idx);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    return Err(anyhow::anyhow!(
                        "Error deserializing term entries for term: {}\n\nCaused by: {}",
                        term,
                        e
                    ));
                }
            };
            Ok(Some(entries))
        } else {
            Ok(None)
        }
    }
}

impl YomitanFrequencyDictionary {
    #[tracing::instrument(skip(self, token_features), fields(dictionary_title = self.0.index.title.clone()))]
    fn lookup_terms(&self, token_features: &Vec<TokenFeature>) -> Result<Vec<TermMetaEntry>> {
        let dictionary_forms = token_features
            .iter()
            .filter_map(|f| match f.dictionary_form.as_ref() {
                Some(dict_form) => Some(dict_form),
                None => {
                    warn!(token = ?f, "Dictionary form not found");
                    None
                }
            })
            .collect::<HashSet<&String>>();

        let mut results = Vec::new();
        for term in dictionary_forms {
            if let Some(entries) = self.lookup_term(term.clone())? {
                results.extend(entries);
            }
        }
        Ok(results)
    }

    fn lookup_term(&self, term: String) -> Result<Option<Vec<TermMetaEntry>>> {
        let res = self
            .0
            .term_meta_bank
            .as_ref()
            .expect("Term meta bank not found")
            .get(&term)?;
        if let Some(res) = res {
            let entries = serde_json::from_str(&res)?;
            Ok(Some(entries))
        } else {
            Ok(None)
        }
    }
}

impl YomitanPitchDictionary {
    fn lookup(&self, term: &str, reading: &str) -> Result<Option<PitchData>> {
        let res = self
            .0
            .term_meta_bank
            .as_ref()
            .expect("Term meta bank not found")
            .get(&term)?;
        if let Some(res) = res {
            let entries: Vec<TermMetaEntry> = serde_json::from_str(&res)?;
            for entry in entries {
                if entry.term == term {
                    if let TermMetaData::Pitch(pitch_data) = &entry.data {
                        if pitch_data.reading == reading {
                            return Ok(Some(pitch_data.clone()));
                        }
                    }
                }
            }
            Ok(None)
        } else {
            Ok(None)
        }
    }
}

#[derive(Debug)]
pub struct PitchAccent {
    pub reading: String, // e.g., "ふちゅうい"
    pub position: u8,    // e.g., 2
    pub mora_count: u8,  // e.g., 4
}

#[derive(Debug)]
pub struct PitchAccents(pub Vec<PitchAccent>);

impl From<&PitchData> for PitchAccents {
    fn from(pitch_data: &PitchData) -> Self {
        let mut pitch_accents = Vec::new();
        for pitch in pitch_data.pitches.iter() {
            pitch_accents.push(PitchAccent {
                reading: pitch_data.reading.clone(),
                position: pitch.position as u8,
                mora_count: pitch_data
                    .reading
                    .chars()
                    .filter(|&c| c != 'ょ' && c != 'ゃ' && c != 'ゅ' && c != 'ょ')
                    .count() as u8,
            });
        }
        PitchAccents(pitch_accents)
    }
}

impl YomitanKanjiDictionary {
    // TODO: Handle dicts which have term_bank rather than kanji_bank
    fn lookup(&self, kanji: String) -> Result<Option<Vec<KanjiEntry>>> {
        let res = self
            .0
            .kanji_bank
            .as_ref()
            .expect("Kanji bank not found")
            .get(&kanji)?;
        if let Some(res) = res {
            let entries = serde_json::from_str(&res)?;
            Ok(Some(entries))
        } else {
            Ok(None)
        }
    }
}
