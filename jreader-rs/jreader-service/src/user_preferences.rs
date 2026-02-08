use crate::dictionaries::{DictionaryInfo, DictionaryType};
use anyhow::Result;
use deadpool_postgres::{Config, Pool};
use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;
use tokio_postgres::NoTls;
use tracing::{info, instrument};
use uuid::Uuid;

#[derive(Debug)]
pub struct UserPreferences {
    pub user_id: Uuid,
    // Term dictionaries
    pub term_dictionary_order: Vec<String>,
    pub term_disabled_dictionaries: HashSet<String>,
    pub term_spoiler_dictionaries: HashSet<String>,
    pub freq_dictionary_order: Vec<String>,
    pub freq_disabled_dictionaries: HashSet<String>,
}

impl UserPreferences {
    pub fn default(user_id: Uuid, dictionary_info: Vec<DictionaryInfo>) -> Self {
        // Use the format "title#revision" for the dictionary order
        let term_dictionaries = dictionary_info
            .iter()
            .filter(|d| d.dictionary_type == DictionaryType::Term)
            .collect::<Vec<_>>();
        let mut term_dictionary_order = term_dictionaries
            .iter()
            .map(|d| format!("{}#{}", d.title, d.revision))
            .collect::<Vec<_>>();
        term_dictionary_order.sort();

        let freq_dictionaries = dictionary_info
            .iter()
            .filter(|d| d.dictionary_type == DictionaryType::Frequency)
            .collect::<Vec<_>>();
        let mut freq_dictionary_order = freq_dictionaries
            .iter()
            .map(|d| format!("{}#{}", d.title, d.revision))
            .collect::<Vec<_>>();
        freq_dictionary_order.sort();
        Self {
            user_id,
            term_dictionary_order: term_dictionary_order,
            term_disabled_dictionaries: HashSet::new(),
            term_spoiler_dictionaries: HashSet::new(),
            freq_dictionary_order: freq_dictionary_order,
            freq_disabled_dictionaries: HashSet::new(),
        }
    }
}

pub trait UserPreferencesStoreAsync {
    #[allow(async_fn_in_trait)]
    async fn save(&self, preferences: &UserPreferences) -> Result<()>;
    #[allow(async_fn_in_trait)]
    async fn get(&self, user_id: Uuid) -> Result<UserPreferences>;
}

pub struct UserPreferencesSupabase {
    pool: Arc<Pool>,
    dictionary_info: Vec<DictionaryInfo>,
}

// Shared pool builder function
pub fn build_shared_pool(
    host: &str,
    port: u16,
    user: &str,
    password: &str,
    database: &str,
) -> Result<Pool> {
    let mut cfg = Config::new();
    cfg.host = Some(host.to_string());
    cfg.port = Some(port);
    cfg.user = Some(user.to_string());
    cfg.password = Some(password.to_string());
    cfg.dbname = Some(database.to_string());

    // Additional Supabase-specific configuration
    cfg.application_name = Some("jreader-service".to_string());
    cfg.connect_timeout = Some(Duration::from_secs(10));
    cfg.keepalives_idle = Some(Duration::from_secs(30));

    // Use the simpler API that should work with default pool settings
    // The key fix is using a single shared pool instead of two separate pools
    Ok(cfg.create_pool(None, NoTls)?)
}

impl UserPreferencesSupabase {
    pub fn new(pool: Arc<Pool>, dictionary_info: Vec<DictionaryInfo>) -> Self {
        Self {
            pool,
            dictionary_info,
        }
    }
}

impl UserPreferencesStoreAsync for UserPreferencesSupabase {
    async fn save(&self, preferences: &UserPreferences) -> Result<()> {
        let client = self.pool.get().await?;

        client.execute(
            r#"INSERT INTO "public"."User Preferences" 
               ("user_id", "term_order", "term_disabled", "term_spoiler", "freq_order", "freq_disabled") 
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT ("user_id") DO UPDATE SET
               "term_order" = $2,
               "term_disabled" = $3,
               "term_spoiler" = $4,
               "freq_order" = $5,
               "freq_disabled" = $6"#,
            &[
                &preferences.user_id,
                &preferences.term_dictionary_order.join(","),
                &preferences.term_disabled_dictionaries.iter().map(|d| d.to_string()).collect::<Vec<_>>().join(","),
                &preferences.term_spoiler_dictionaries.iter().map(|d| d.to_string()).collect::<Vec<_>>().join(","),
                &preferences.freq_dictionary_order.join(","),
                &preferences.freq_disabled_dictionaries.iter().map(|d| d.to_string()).collect::<Vec<_>>().join(","),
            ],
        ).await?;

        Ok(())
    }

    #[instrument(skip(self))]
    async fn get(&self, user_id: Uuid) -> Result<UserPreferences> {
        let client = self.pool.get().await?;
        let statement = client.prepare(
            r#"SELECT "term_order", "term_disabled", "term_spoiler", "freq_order", "freq_disabled"
               FROM "public"."User Preferences"
               WHERE "user_id" = $1"#,
        ).await?;

        let row = client.query_opt(&statement, &[&user_id]).await?;

        // If there is no row for this user, insert a default one
        let row = match row {
            Some(row) => row,
            None => {
                info!("No row found for user, inserting default");
                let preferences = UserPreferences::default(user_id, self.dictionary_info.clone());
                self.save(&preferences).await?;
                client.query_one(&statement, &[&user_id]).await?
            }
        };

        Ok(UserPreferences {
            user_id,
            term_dictionary_order: row
                .get::<_, String>(0)
                .split(',')
                .map(String::from)
                .collect(),
            term_disabled_dictionaries: row
                .get::<_, String>(1)
                .split(',')
                .filter(|s| !s.is_empty())
                .map(String::from)
                .collect(),
            term_spoiler_dictionaries: row
                .get::<_, String>(2)
                .split(',')
                .filter(|s| !s.is_empty())
                .map(String::from)
                .collect(),
            freq_dictionary_order: row
                .get::<_, String>(3)
                .split(',')
                .map(String::from)
                .collect(),
            freq_disabled_dictionaries: row
                .get::<_, String>(4)
                .split(',')
                .filter(|s| !s.is_empty())
                .map(String::from)
                .collect(),
        })
    }
}

mod tests {
    #[allow(unused_imports)]
    use super::*;

    #[tokio::test]
    #[ignore]
    async fn test_supabase() {
        dotenvy::dotenv().unwrap();
        let pool = build_shared_pool(
            &std::env::var("SUPABASE_URL").unwrap(),
            std::env::var("SUPABASE_PORT").unwrap().parse().unwrap(),
            &std::env::var("SUPABASE_USER").unwrap(),
            &std::env::var("SUPABASE_PASSWORD").unwrap(),
            &std::env::var("SUPABASE_DATABASE").unwrap(),
        )
        .unwrap();
        let supabase = UserPreferencesSupabase::new(Arc::new(pool), vec![]);
        let preferences = UserPreferences {
            user_id: Uuid::new_v4(),
            term_dictionary_order: vec!["".to_string()],
            term_disabled_dictionaries: HashSet::new(),
            term_spoiler_dictionaries: HashSet::new(),
            freq_dictionary_order: vec!["".to_string()],
            freq_disabled_dictionaries: HashSet::new(),
        };
        supabase.save(&preferences).await.unwrap();
        let preferences = supabase.get(preferences.user_id).await.unwrap();
        assert_eq!(preferences.term_dictionary_order, vec![""]);
        assert_eq!(preferences.term_disabled_dictionaries, HashSet::new());
        assert_eq!(preferences.term_spoiler_dictionaries, HashSet::new());
        assert_eq!(preferences.freq_dictionary_order, vec![""]);
        assert_eq!(preferences.freq_disabled_dictionaries, HashSet::new());
        println!("{:?}", preferences);
    }
}
