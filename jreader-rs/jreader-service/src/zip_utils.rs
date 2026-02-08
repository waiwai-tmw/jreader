use anyhow::Result;
use camino::{Utf8Path as Path, Utf8PathBuf as PathBuf};
use tracing::info;
use zip_extensions::*;

pub async fn unzip_to_cache(file_path: &Path, cache_dir: &Path) -> Result<PathBuf> {
    info!("📚 Extracting archive to cache");
    let file_path_std = file_path.to_path_buf().into_std_path_buf();
    let cache_dir_std = cache_dir.to_path_buf().into_std_path_buf();
    zip_extract(&file_path_std, &cache_dir_std)?;
    info!("✅ Successfully extracted archive to cache");
    Ok(cache_dir.to_path_buf())
}
