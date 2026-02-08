use camino::{Utf8Path as Path, Utf8PathBuf as PathBuf};
use unicode_normalization::UnicodeNormalization;

pub mod json_schema;
pub mod kv_store;

pub fn add(left: u64, right: u64) -> u64 {
    left + right
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let result = add(2, 2);
        assert_eq!(result, 4);
    }
}

#[derive(Debug, Clone)]
pub struct NormalizedPathBuf {
    pub path: PathBuf,
    pub filename: NormalizedFilename,
}

#[derive(Debug, Clone)]
pub struct NormalizedFilename(pub String);

impl NormalizedPathBuf {
    pub fn new(path: &Path) -> Self {
        let normalized_path: PathBuf = PathBuf::from(path.as_str().nfc().collect::<String>());
        let filename = {
            let filename = normalized_path
                .file_name()
                .expect(&format!("Failed to get file name for {normalized_path:?}"));
            // Remove the .zip extension from the filename
            let split = filename.split('.').collect::<Vec<&str>>();
            split[0..split.len() - 1].join(".")
        };

        Self {
            path: normalized_path,
            filename: NormalizedFilename(filename),
        }
    }
}
