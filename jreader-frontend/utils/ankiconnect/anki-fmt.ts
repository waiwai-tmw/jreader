import { getMainDefinition, getGlossary } from './definitionProcessing';
import { formatFrequencyList, extractFrequencyRanks, frequencyHarmonicRank } from './frequencyUtils';

// Convert pitch accent numbers to category names
const convertPitchAccentToCategories = (pitchAccent: string): string => {
    if (!pitchAccent) return '';
    
    const categories: Record<string, string> = {
      '0': 'heiban',
      '1': 'atamadaka',
      '2': 'nakadaka',
      '3': 'odaka',
      '4': 'kifuku',
      '5': 'kifuku',
      '6': 'kifuku',
      '7': 'kifuku',
      '8': 'kifuku',
      '9': 'kifuku'
    };
    
    // Handle comma-separated values like "4,0"
    return pitchAccent.split(',').map(num => categories[num.trim()] || num.trim()).join(',');
  };

  // Build Anki note fields from card data and field mappings
export const buildAnkiNoteFields = (card: Record<string, any>, fieldMappings: Record<string, any>): { noteFields: Record<string, string>; audioFields: Record<string, string>; imageFields: Record<string, string> } => {
    const noteFields: Record<string, string> = {};
    const audioFields: Record<string, string> = {};
    const imageFields: Record<string, string> = {};
    
    console.log('🎵 DEBUG: Card expression_audio value:', {
      cardId: card['id'],
      expression_audio: card['expression_audio'],
      hasExpressionAudio: !!card['expression_audio'],
      expressionAudioType: typeof card['expression_audio']
    });

    console.log('🎵 DEBUG: Full card data received by extension:', {
      cardId: card['id'],
      expression: card['expression'],
      reading: card['reading'],
      expression_audio: card['expression_audio'],
      allCardKeys: Object.keys(card)
    });
    
    // Log all card properties to see what's actually there
    console.log('🎵 DEBUG: All card properties:', card);
    
    // Apply field mappings
    for (const [ankiField, mapping] of Object.entries(fieldMappings || {})) {
      console.log(`🔍 Processing field mapping: ${ankiField} = "${mapping}"`);
      if (!mapping || mapping === 'none') {
        console.log(`⏭️ Skipping field ${ankiField} (mapping is empty or 'none')`);
        continue;
      }
      
      let value = '';
      switch (mapping) {
        case '{expression}':
          value = card['expression'] || '';
          break;
        case '{reading}':
          value = card['reading'] || '';
          break;
        case '{main_definition}':
          const mainDefResult = getMainDefinition(card['definitions']);
          value = mainDefResult.html;
          // Store image paths for later processing with unique field names including dictionary name
          console.log('🔄 IMAGE_SYNC: Main definition has', mainDefResult.imagePathsWithDictionary.length, 'images');
          mainDefResult.imagePathsWithDictionary.forEach(({path, dictionary, index}) => {
            const dictHash = dictionary ? dictionary.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36) : 'unknown';
            imageFields[`main_definition_image_${dictHash}_${index}`] = path;
            console.log('🔄 IMAGE_SYNC: Added main definition image field:', `main_definition_image_${dictHash}_${index}`, '->', path);
          });
          break;
        case '{glossary}':
          const glossaryResult = getGlossary(card['definitions'], fieldMappings);
          value = glossaryResult.html;
          // Store image paths for later processing with unique field names including dictionary name
          console.log('🔄 IMAGE_SYNC: Glossary has', glossaryResult.imagePathsWithDictionary.length, 'images');
          glossaryResult.imagePathsWithDictionary.forEach(({path, dictionary, index}) => {
            const dictHash = dictionary ? dictionary.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36) : 'unknown';
            imageFields[`glossary_image_${dictHash}_${index}`] = path;
            console.log('🔄 IMAGE_SYNC: Added glossary image field:', `glossary_image_${dictHash}_${index}`, '->', path);
          });
          break;
        case '{sentence}':
          value = card['sentence'] || '';
          break;
        case '{pitch_accent}':
          value = card['pitch_accent'] || '';
          break;
        case '{pitch_position}':
          value = card['pitch_accent'] || ''; // Same as pitch_accent for now
          console.log(`🎵 Pitch position mapping: ${ankiField} = "${mapping}" -> "${value}" (from pitch_accent: "${card['pitch_accent']}")`);
          break;
        case '{pitch_categories}':
          value = convertPitchAccentToCategories(card['pitch_accent'] || '');
          console.log(`🎵 Pitch categories mapping: ${ankiField} = "${mapping}" -> "${value}" (from pitch_accent: "${card['pitch_accent']}")`);
          break;
        case '{expression_furigana}':
          if (card['expression'] && card['reading']) {
            value = `${card['expression']}[${card['reading']}]`;
          } else {
            value = '';
          }
          console.log(`🎵 Expression furigana mapping: ${ankiField} = "${mapping}" -> "${value}" (expression: "${card['expression']}", reading: "${card['reading']}")`);
          break;
        case '{expression_audio}':
          // Store audio URL for later processing
          console.log('🎵 DEBUG: Processing expression_audio field:', {
            ankiField,
            cardExpressionAudio: card['expression_audio'],
            hasExpressionAudio: !!card['expression_audio'],
            expressionAudioType: typeof card['expression_audio']
          });
          if (card['expression_audio']) {
            // Handle both string and object cases
            let audioUrl = card['expression_audio'];
            if (typeof card['expression_audio'] === 'object') {
              console.log('🎵 DEBUG: expression_audio is an object, extracting URL...');
              // If it's an object, try to extract the URL from common properties
              audioUrl = card['expression_audio'].url || card['expression_audio'].path || card['expression_audio'];
              console.log('🎵 DEBUG: Extracted audioUrl from object:', audioUrl);
            }
            if (audioUrl && typeof audioUrl === 'string') {
              // Make sure the extension is .mp3, not .opus (at the end of the string)
              audioUrl = audioUrl.replace(/\.opus$/, '.mp3');
              audioFields[ankiField] = audioUrl;
              value = '[sound:audio.mp3]'; // Placeholder that will be replaced with actual audio
              console.log('🎵 DEBUG: Added to audioFields:', { ankiField, audioUrl });
            } else {
              console.log('🎵 DEBUG: No valid expression_audio data for field:', ankiField);
            }
          } else {
            console.log('🎵 DEBUG: No expression_audio data for field:', ankiField);
          }
          break;
        case '{document-title}':
          value = card['document_title'] || '';
          break;
        case '{frequency}':
          value = formatFrequencyList(card['frequency']);
          break;
        case '{frequency-harmonic-rank}':
          const frequencyRanks = extractFrequencyRanks(card['frequency']);
          value = frequencyHarmonicRank(frequencyRanks).toString();
          break;
        default:
          // Handle custom field mappings
          const fieldName = (mapping as string).replace(/[{}]/g, '');
          value = card[fieldName] || '';
      }
      
      noteFields[ankiField] = value;
      console.log(`📝 Field mapping: ${ankiField} = "${mapping}" -> "${value}"`);
    }
    
    console.log('📋 Final note fields:', noteFields);
    console.log('🎵 Audio fields:', audioFields);
    console.log('🖼️ Image fields:', imageFields);
    console.log('🔄 IMAGE_SYNC: Total image fields created:', Object.keys(imageFields).length, 'Fields:', Object.keys(imageFields));
    return { noteFields, audioFields, imageFields };
  };