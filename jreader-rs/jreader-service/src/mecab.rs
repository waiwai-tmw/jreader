use tracing::trace;
use vibrato::tokenizer::worker::Worker;

// MeCab feature string (Japanese)
#[derive(Debug, Clone)]
pub struct TokenFeature {
    // Surface form (表層形) - The actual text as it appears
    pub surface_form: Option<String>,
    // Part of Speech (品詞) - e.g., 名詞(noun), 動詞(verb), 助詞(particle)
    pub pos: Option<String>,
    // POS Subtype 1 (品詞細分類1) - e.g., 一般(general), 固有名詞(proper noun)
    pub pos_subtype_1: Option<String>,
    // POS Subtype 2 (品詞細分類2) - e.g., 域(region) for place names
    pub pos_subtype_2: Option<String>,
    // POS Subtype 3 (品詞細分類3) - Additional classification
    pub pos_subtype_3: Option<String>,
    // Conjugation Type (活用型) - How it conjugates ( for non-conjugating words)
    pub conjugation_type: Option<String>,
    // Conjugation Form (活用形) - Current conjugation ( for non-conjugating words)
    pub conjugation_form: Option<String>,
    // Dictionary Form (原形) - Base/dictionary form
    pub dictionary_form: Option<String>,
    // Reading (読み) - Katakana reading
    pub reading: Option<String>,
    // Pronunciation (発音) - Actual pronunciation (can differ from reading)
    pub pronunciation: Option<String>,
}

impl TokenFeature {
    pub fn from_feature_string(surface_form: &str, feature_string: &str) -> Self {
        trace!("🔍 Feature string: {}", feature_string);
        let fields: Vec<&str> = feature_string.split(',').collect();
        // Pad with None values if we don't have enough fields
        let mut padded_fields = vec![None; 9];
        for (i, field) in fields.iter().enumerate() {
            padded_fields[i] = if *field == "*" {
                None
            } else {
                Some((*field).to_string())
            };
        }

        Self {
            surface_form: Some(surface_form.to_string()),
            pos: padded_fields[0].clone(),
            pos_subtype_1: padded_fields[1].clone(),
            pos_subtype_2: padded_fields[2].clone(),
            pos_subtype_3: padded_fields[3].clone(),
            conjugation_type: padded_fields[4].clone(),
            conjugation_form: padded_fields[5].clone(),
            dictionary_form: padded_fields[6].clone(),
            reading: padded_fields[7].clone(),
            pronunciation: padded_fields[8].clone(),
        }
    }
}

pub fn analyze_tokens(worker: &mut Worker, text: &str, position: usize) -> Vec<TokenFeature> {
    worker.reset_sentence(text);
    worker.tokenize();
    let tokens = worker.token_iter().collect::<Vec<_>>();

    let mut entries = Vec::new();

    // Find token at position and analyze compounds
    for (i, token) in tokens.iter().enumerate() {
        // Convert byte range to char indices
        let start_char = text[..token.range_byte().start].chars().count();
        let end_char = start_char + token.surface().chars().count();
        let char_range = start_char..end_char;

        if char_range.contains(&position) {
            let feature = TokenFeature::from_feature_string(token.surface(), token.feature());

            // Handle compound words and verbs
            if let Some("詞") = feature.pos.as_deref() {
                if i + 1 < tokens.len() {
                    let next_token = &tokens[i + 1];
                    let next_feature = TokenFeature::from_feature_string(
                        next_token.surface(),
                        next_token.feature(),
                    );

                    if next_feature.pos.as_deref() == Some("動詞") {
                        let compound = TokenFeature {
                            surface_form: Some(format!(
                                "{}{}",
                                token.surface(),
                                next_token.surface()
                            )),
                            dictionary_form: Some(format!(
                                "{}{}",
                                feature
                                    .dictionary_form
                                    .as_ref()
                                    .unwrap_or(&token.surface().to_string()),
                                next_feature
                                    .dictionary_form
                                    .as_ref()
                                    .unwrap_or(&next_token.surface().to_string())
                            )),
                            ..feature.clone()
                        };
                        entries.push(compound);
                    }
                }
            } else if let Some("名詞") = feature.pos.as_deref() {
                let mut compound_surface = token.surface().to_string();
                let mut j = i + 1;
                while j < tokens.len() {
                    let next_token = &tokens[j];
                    let next_feature = TokenFeature::from_feature_string(
                        next_token.surface(),
                        next_token.feature(),
                    );

                    if next_feature.pos.as_deref() == Some("名詞") {
                        compound_surface.push_str(next_token.surface());
                        entries.push(TokenFeature {
                            surface_form: Some(compound_surface.clone()),
                            dictionary_form: Some(compound_surface.clone()),
                            ..feature.clone()
                        });
                        j += 1;
                    } else {
                        break;
                    }
                }
            }

            // Always include the individual token
            entries.push(feature);
        }
    }

    entries
        .sort_by_key(|entry| std::cmp::Reverse(entry.surface_form.as_ref().map_or(0, |s| s.len())));

    entries
}
