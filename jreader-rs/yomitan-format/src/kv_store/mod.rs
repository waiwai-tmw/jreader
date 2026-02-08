pub mod db;
pub mod utils;

use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::sync::Arc;

use anyhow::Result;
use camino::Utf8Path as Path;
use serde_json;
use tracing::debug;
use utils::CreateTaskParams;
use utils::ProgressGroupId;
use utils::ProgressStateTable;
use utils::ProgressTaskType;
use zip::ZipArchive;

pub trait IsYomitanSchema {
    fn get_schema_prefix() -> &'static str;
    fn get_schema_name() -> &'static str;
}

pub struct GroupedJSON(pub HashMap<String, Vec<serde_json::Value>>);

impl GroupedJSON {
    pub fn new(paths: Vec<&Path>) -> Result<Self> {
        let mut merged_json = Vec::new();
        for path in paths {
            let json_str = std::fs::read_to_string(path).expect(&format!("Failed to read {path}"));
            let json: Vec<serde_json::Value> =
                serde_json::from_str(&json_str).expect(&format!("Failed to parse {path}"));
            merged_json.extend(json);
        }
        Self::from_json(merged_json)
    }

    pub fn new_from_archive<SchemaType: IsYomitanSchema>(
        archive: &mut ZipArchive<File>,
        progress_state: Arc<ProgressStateTable>,
        dictionary_title: String,
        dictionary_revision: String,
        group_id: ProgressGroupId,
    ) -> Result<Self> {
        let prefix = SchemaType::get_schema_prefix();
        let json_paths_in_archive = find_files_with_prefix(archive, prefix);

        let merged_json = {
            let params = CreateTaskParams {
                task_type: ProgressTaskType::MergeJson,
                dictionary_title,
                dictionary_revision,
                schema_name: Some(SchemaType::get_schema_name().to_string()),
                total: json_paths_in_archive.len() as i64,
            };
            debug!("Creating task {:?}", params);
            let task_id = progress_state.create_task(params, group_id)?;

            let mut merged_json: Vec<serde_json::Value> = Vec::new();
            for file in json_paths_in_archive {
                let mut file_in_zip = archive.by_name(&file)?;
                let json_values: Vec<serde_json::Value> =
                    serde_json::from_reader(&mut file_in_zip)?;
                merged_json.extend(json_values);
                progress_state.increment(&task_id, 1)?;
            }
            merged_json
        };

        Ok(Self::from_json(merged_json)?)
    }

    fn from_json(json: Vec<serde_json::Value>) -> Result<Self> {
        let mut map: HashMap<String, Vec<serde_json::Value>> = HashMap::new();
        for value in json {
            let text = value.get(0).and_then(|text| text.as_str()).unwrap();
            if let Some(entry) = map.get_mut(text) {
                entry.push(value);
            } else {
                map.insert(text.to_string(), vec![value]);
            }
        }
        Ok(Self(map))
    }
}

fn find_files_with_prefix(archive: &mut ZipArchive<File>, prefix: &str) -> Vec<String> {
    (0..archive.len())
        .filter_map(|i| {
            let file = archive.by_index(i).ok()?;
            let name = file.name().to_owned();
            if name.starts_with(prefix) {
                Some(name)
            } else {
                None
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn test_first_term_entry_json() {
        let term_bank = GroupedJSON::new(vec![Path::new(
            "data/dictionaries/valid-dictionary1/term_bank_1.json",
        )])
        .unwrap();
        assert!(!term_bank.0.is_empty());

        #[rustfmt::skip]
        assert_eq!(*term_bank.0.get("打").unwrap(), vec![json!(["打", "だ", "n", "n", 1, ["da definition 1", "da definition 2"], 1, "E1"]), json!(["打", "ダース", "n abbr", "n", 1, ["daasu definition 1", "daasu definition 2"], 2, "E1"])]);

        #[rustfmt::skip]
        assert_eq!(*term_bank.0.get("打つ").unwrap(), vec![json!(["打つ", "うつ", "vt", "v5", 10, ["utsu definition 1", "utsu definition 2"], 3, "P E1"]), json!(["打つ", "うつ", "vt", "v5", 1, ["utsu definition 3", "utsu definition 4"], 3, "P E2"]), json!(["打つ", "ぶつ", "vt", "v5", 10, ["butsu definition 1", "butsu definition 2"], 3, "P E1"]), json!(["打つ", "ぶつ", "vt", "v5", 1, ["butsu definition 3", "butsu definition 4"], 3, "P E2"])]);
        // TODO: Add the rest of the assertions for the other entries
    }
}
