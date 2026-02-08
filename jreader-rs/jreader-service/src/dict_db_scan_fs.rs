use crate::dictionaries::YomitanDictionaries;
use anyhow::{Context, Result};
use camino::Utf8PathBuf as PathBuf;
use std::fs::{self, File};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, error, info, instrument, trace, warn};
use uuid::Uuid;
use yomitan_format::json_schema::index::DictionaryIndex;
use yomitan_format::json_schema::kanji_bank_v3::KanjiBankV3;
use yomitan_format::json_schema::kanji_meta_bank_v3::KanjiMetaBankV3;
use yomitan_format::json_schema::tag_bank_v3::TagBankV3;
use yomitan_format::json_schema::term_bank_v3::TermBankV3;
use yomitan_format::json_schema::term_meta_bank_v3::TermMetaBankV3;
use yomitan_format::kv_store::db::DictionaryDB;
use yomitan_format::kv_store::utils::{
    CreateTaskParams, ProgressGroupId, ProgressStateTable, ProgressTaskType,
};
use yomitan_format::kv_store::{GroupedJSON, IsYomitanSchema};
use yomitan_format::{NormalizedFilename, NormalizedPathBuf};
use zip::ZipArchive;

#[instrument(skip(progress_state, yomi_dicts))]
pub async fn scan_fs(
    progress_state: Arc<ProgressStateTable>,
    yomi_dicts: Option<Arc<RwLock<YomitanDictionaries>>>,
    max_size_mb: Option<u64>,
) -> Result<()> {
    let dicts_path: PathBuf = {
        dotenvy::dotenv().context(format!("Failed to load .env file"))?;
        let dicts_path =
            std::env::var("DICTS_PATH").context(format!("Failed to load DICTS_PATH"))?;
        PathBuf::from(dicts_path)
    };

    let yomitan_dir_path = &dicts_path.join("yomitan");
    info!(path = %yomitan_dir_path, "Scanning directory");

    match fs::read_dir(yomitan_dir_path) {
        Ok(entries) => {
            let mut entries: Vec<_> = entries
                .filter_map(|e| {
                    if let Err(ref e) = e {
                        warn!(?e, "Error reading directory entry");
                    }
                    e.ok()
                })
                .collect();
            entries.sort_by_key(|e| e.path());

            let total_entries = entries.len();
            info!(total_entries = %total_entries, "Found entries in directory");
            let mut zip_count = 0;
            let mut processed_count = 0;
            let mut skipped_count = 0;
            let mut error_count = 0;
            let mut size_filtered_count = 0;

            for entry in entries {
                let yomitan_dict_path = PathBuf::try_from(entry.path()).expect(&format!(
                    "Failed to convert path to PathBuf for {}",
                    entry.path().display()
                ));

                if yomitan_dict_path.is_file() {
                    if yomitan_dict_path.extension().map_or(false, |s| s == "zip") {
                        zip_count += 1;

                        // Check file size if max_size_mb is specified
                        if let Some(max_size) = max_size_mb {
                            if let Ok(metadata) = fs::metadata(&yomitan_dict_path) {
                                let size_mb = metadata.len() / (1024 * 1024);
                                if size_mb > max_size {
                                    size_filtered_count += 1;
                                    let filename = yomitan_dict_path
                                        .file_name()
                                        .unwrap_or_default()
                                        .to_string();
                                    info!(
                                        %filename,
                                        %size_mb,
                                        progress = %(processed_count + skipped_count + error_count),
                                        total = %zip_count,
                                        "Skipping large dictionary"
                                    );
                                    continue;
                                }
                            }
                        }

                        let normalized = NormalizedPathBuf::new(&yomitan_dict_path);

                        // Check if dictionary already exists
                        // let dict_dir = dicts_path.join("db").join(&normalized.filename.0);
                        let dict_dir = NormalizedPathBuf::new(
                            &dicts_path.join("db").join(&normalized.filename.0),
                        );
                        if dict_dir.path.exists() {
                            skipped_count += 1;
                            info!(
                                filename = %normalized.filename.0,
                                progress = %(processed_count + skipped_count + error_count),
                                total = %zip_count,
                                "Dictionary already exists, skipping ahead to registration"
                            );
                        } else {
                            if normalized.path != yomitan_dict_path {
                                info!(
                                    normalized_path = ?normalized,
                                    "Moving file to normalized path"
                                );
                                tokio::fs::rename(yomitan_dict_path, &normalized.path).await?;
                            }

                            info!(
                                filename = %normalized.filename.0,
                                progress = %(processed_count + skipped_count + error_count + 1),
                                total = %zip_count,
                                "Processing archive"
                            );

                            if let Err(e) = process_archive(
                                dicts_path.clone(),
                                normalized.clone(),
                                progress_state.clone(),
                                dict_dir.clone(),
                            )
                            .await
                            {
                                error_count += 1;
                                error!(?e, ?normalized, "Error processing archive");
                                continue; // TODO: Remove usage of continue for better control flow
                            } else {
                                processed_count += 1;
                            }
                        }

                        if let Some(yomi_dicts) = yomi_dicts.clone() {
                            if let Err(e) = yomi_dicts
                                .write()
                                .await
                                .register_dictionary(dict_dir.clone())
                            {
                                warn!(?e, filename = ?normalized.filename.0, dict_dir = ?dict_dir, "Failed to register dictionary");
                            } else {
                                info!(
                                    filename = ?normalized.filename.0,
                                    dict_dir = ?dict_dir,
                                    "Added dictionary to YomitanDictionaries"
                                );
                            }
                        } else {
                            debug!("YomitanDictionaries not found, skipping registration");
                        }
                    }
                }
            }

            info!(
                %total_entries,
                zip_files = %zip_count,
                processed = %processed_count,
                skipped = %skipped_count,
                size_filtered = %size_filtered_count,
                errors = %error_count,
                "Scan complete"
            );
        }
        Err(e) => error!(?e, "Error reading directory"),
    }

    Ok(())
}

async fn process_archive(
    dicts_path: PathBuf,
    archive_path: NormalizedPathBuf,
    progress_state: Arc<ProgressStateTable>,
    dict_dir: NormalizedPathBuf,
) -> Result<()> {
    let zip_file = std::fs::File::open(archive_path.path.as_path())?;
    let mut archive = ZipArchive::new(zip_file)?;

    if dict_dir.path.exists() {
        info!(
            "Dictionary directory already exists, skipping: {}",
            archive_path.filename.0
        );
    } else {
        debug!("Dictionary filename: {}", archive_path.filename.0);
        // Create directory and process index file
        fs::create_dir(dict_dir.path.as_path())?;
        info!("Created dictionary directory: {:?}", dict_dir.path);

        let index_json_file_path = dict_dir.path.join("index.json");
        {
            let mut index_json_zip_file = archive.by_name("index.json")?;
            let mut index_json_file = File::create(&index_json_file_path)?;
            std::io::copy(&mut index_json_zip_file, &mut index_json_file)?;
        }

        let index: DictionaryIndex =
            serde_json::from_str(&std::fs::read_to_string(index_json_file_path)?)?;

        let group_id = ProgressGroupId(Uuid::new_v4());
        process_schema::<TermBankV3>(
            dict_dir.clone(),
            &mut archive,
            progress_state.clone(),
            &index,
            group_id,
        )?;
        process_schema::<TagBankV3>(
            dict_dir.clone(),
            &mut archive,
            progress_state.clone(),
            &index,
            group_id,
        )?;
        process_schema::<TermMetaBankV3>(
            dict_dir.clone(),
            &mut archive,
            progress_state.clone(),
            &index,
            group_id,
        )?;
        process_schema::<KanjiBankV3>(
            dict_dir.clone(),
            &mut archive,
            progress_state.clone(),
            &index,
            group_id,
        )?;
        process_schema::<KanjiMetaBankV3>(
            dict_dir.clone(),
            &mut archive,
            progress_state.clone(),
            &index,
            group_id,
        )?;
        copy_static_assets(
            dicts_path.clone(),
            archive_path.filename.clone(),
            &mut archive,
            progress_state.clone(),
            &index,
            group_id,
        )?;
    }

    Ok(())
}

fn process_schema<SchemaType: IsYomitanSchema>(
    dict_dir: NormalizedPathBuf,
    archive: &mut ZipArchive<File>,
    progress_state: Arc<ProgressStateTable>,
    index: &DictionaryIndex,
    group_id: ProgressGroupId,
) -> Result<()>
where
    SchemaType: Send + 'static,
{
    let grouped_json = GroupedJSON::new_from_archive::<SchemaType>(
        archive,
        progress_state.clone(),
        index.title.clone(),
        index.revision.clone(),
        group_id,
    )?;
    if grouped_json.0.len() > 0 {
        info!(
            "Inserting schema: {} for {}",
            SchemaType::get_schema_name(),
            index.title
        );
        let db = DictionaryDB::<SchemaType>::new(dict_dir.clone());
        match db {
            Ok(db) => {
                debug!(
                    "Inserting all entries into dictionary DB for path: {:?}",
                    dict_dir
                );
                db.insert_all(
                    &grouped_json,
                    progress_state,
                    index.title.clone(),
                    index.revision.clone(),
                    group_id,
                )?;
            }
            Err(e) => error!(
                "Error creating dictionary DB for path: {:?}: {}",
                dict_dir, e
            ),
        }
    }
    Ok(())
}

fn copy_static_assets(
    dicts_path: PathBuf,
    dict_filename: NormalizedFilename,
    archive: &mut ZipArchive<File>,
    progress_state: Arc<ProgressStateTable>,
    index: &DictionaryIndex,
    group_id: ProgressGroupId,
) -> Result<()> {
    // Any files that are not JSON should be copied over to the dictionaries-static/{dict_name} directory
    let dict_static_dir = &dicts_path.join("static").join(&dict_filename.0);

    if dict_static_dir.exists() {
        info!(
            "Dictionary static directory already exists, skipping: {}",
            dict_filename.0
        );
    } else {
        info!("Checking for static assets in for {}", dict_filename.0);
        // Files may be nested in subdirectories, so we need to copy them over recursively
        if archive.len() > 0 {
            // Count actual files to copy (excluding .json files and directories)
            let total_files = (0..archive.len())
                .filter(|&i| {
                    if let Ok(file) = archive.by_index(i) {
                        !file.is_dir() && !file.name().ends_with(".json")
                    } else {
                        false
                    }
                })
                .count();

            let params = CreateTaskParams {
                task_type: ProgressTaskType::CopyStaticAssets,
                dictionary_title: index.title.clone(),
                dictionary_revision: index.revision.clone(),
                schema_name: None,
                total: total_files as i64,
            };
            debug!("Creating task {:?}", params);

            let task_id = progress_state.create_task(params, group_id)?;

            for i in 0..archive.len() {
                let mut file = archive.by_index(i)?;
                let name = file.name().replace('\\', "/");

                if name.ends_with(".json") || file.is_dir() {
                    continue;
                }

                let outpath = dict_static_dir.join(name);
                if let Some(p) = outpath.parent() {
                    fs::create_dir_all(p)?;
                }
                let mut outfile = File::create(&outpath)?;
                std::io::copy(&mut file, &mut outfile)?;

                trace!("Copied file to: {outpath}");
                progress_state.increment(&task_id, 1)?;
            }
            info!("Copied {} static assets for {}", total_files, index.title);
        }
    }
    Ok(())
}
