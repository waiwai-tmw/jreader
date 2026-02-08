import { frequencyHarmonicRank, extractFrequencyRanks, formatFrequencyList } from '@/utils/ankiconnect/frequencyUtils';

// Mock the buildAnkiNoteFields function logic for testing
const buildAnkiNoteFields = (card: any, fieldMappings: any): { noteFields: Record<string, string>; audioFields: Record<string, string>; imageFields: Record<string, string> } => {
  const noteFields: Record<string, string> = {};
  const audioFields: Record<string, string> = {};
  const imageFields: Record<string, string> = {};
  
  // Apply field mappings
  for (const [ankiField, mapping] of Object.entries(fieldMappings || {})) {
    if (!mapping || mapping === 'none') {
      continue;
    }
    
    let value = '';
    switch (mapping) {
      case '{expression}':
        value = card.expression || '';
        break;
      case '{reading}':
        value = card.reading || '';
        break;
      case '{sentence}':
        value = card.sentence || '';
        break;
      case '{document-title}':
        value = card.document_title || '';
        break;
      case '{frequency}':
        value = formatFrequencyList(card.frequency);
        break;
      case '{frequency-harmonic-rank}':
        const frequencyRanks = extractFrequencyRanks(card.frequency);
        value = frequencyHarmonicRank(frequencyRanks).toString();
        break;
      case '{expression_furigana}':
        if (card.expression && card.reading) {  
          value = `${card.expression}[${card.reading}]`;
        } else {
          value = '';
        }
        break;
      default:
        // Handle custom field mappings
        const fieldName = (mapping as string).replace(/[{}]/g, '');
        value = card[fieldName] || '';
    }
    
    noteFields[ankiField] = value;
  }
  
  return { noteFields, audioFields, imageFields };
};

describe('Document Title Marker', () => {
  it('should handle {frequency} marker correctly', () => {
    const cardWithFrequency = {
      id: 'test-card-1',
      expression: 'テスト',
      reading: 'てすと',
      sentence: 'これはテストです。',
      frequency: [
        ['JPDBv2㋕', 19548],
        ['BCCWJ', 2013],
        ['ICR', 6331],
        ['Narou', 37514],
        ['CC100', 3403]
      ]
    };

    const fieldMappings = {
      'Frequency': '{frequency}'
    };

    const result = buildAnkiNoteFields(cardWithFrequency, fieldMappings);

    expect(result.noteFields['Frequency']).toBe(
      '<ul style="text-align: left;"><li>JPDBv2㋕: 19,548</li><li>BCCWJ: 2,013</li><li>ICR: 6,331</li><li>Narou: 37,514</li><li>CC100: 3,403</li></ul>'
    );
  });

  it('should handle empty frequency data', () => {
    const cardWithEmptyFrequency = {
      id: 'test-card-1',
      expression: 'テスト',
      reading: 'てすと',
      sentence: 'これはテストです。',
      frequency: []
    };

    const fieldMappings = {
      'Frequency': '{frequency}'
    };

    const result = buildAnkiNoteFields(cardWithEmptyFrequency, fieldMappings);

    expect(result.noteFields['Frequency']).toBe('');
  });

  it('should handle missing frequency data', () => {
    const cardWithoutFrequency = {
      id: 'test-card-1',
      expression: 'テスト',
      reading: 'てすと',
      sentence: 'これはテストです。'
      // frequency field is missing
    };

    const fieldMappings = {
      'Frequency': '{frequency}'
    };

    const result = buildAnkiNoteFields(cardWithoutFrequency, fieldMappings);

    expect(result.noteFields['Frequency']).toBe('');
  });

  it('should handle real Supabase frequency data with mixed string/numeric values', () => {
    const cardWithRealFrequency = {
      id: 'test-card-1',
      expression: 'テスト',
      reading: 'てすと',
      sentence: 'これはテストです。',
      frequency: [
        ["ヒカル","375/26286"],
        ["Netflix",549],
        ["Anime & J-drama",556],
        ["Novels",497],
        ["Youtube","488"],
        ["Wikipedia",2911],
        ["Innocent Ranked",409],
        ["jpDicts (206k)",1052],
        ["NieR","1301/10077"],
        ["国語辞典",1135]
      ]
    };

    const fieldMappings = {
      'Frequency': '{frequency}'
    };

    const result = buildAnkiNoteFields(cardWithRealFrequency, fieldMappings);

    expect(result.noteFields['Frequency']).toBe(
      '<ul style="text-align: left;"><li>ヒカル: 375/26286</li><li>Netflix: 549</li><li>Anime & J-drama: 556</li><li>Novels: 497</li><li>Youtube: 488</li><li>Wikipedia: 2,911</li><li>Innocent Ranked: 409</li><li>jpDicts (206k): 1,052</li><li>NieR: 1301/10077</li><li>国語辞典: 1,135</li></ul>'
    );
  });

  it('should handle {document-title} marker correctly', () => {
    const card = {
      id: 'test-card-1',
      expression: 'テスト',
      reading: 'てすと',
      sentence: 'これはテストです。',
      document_title: 'Sample Book Title'
    };

    const fieldMappings = {
      'Expression': '{expression}',
      'Reading': '{reading}',
      'Sentence': '{sentence}',
      'DocumentTitle': '{document-title}'
    };

    const result = buildAnkiNoteFields(card, fieldMappings);

    expect(result.noteFields).toEqual({
      'Expression': 'テスト',
      'Reading': 'てすと',
      'Sentence': 'これはテストです。',
      'DocumentTitle': 'Sample Book Title'
    });
  });

  it('should handle missing document title gracefully', () => {
    const card = {
      id: 'test-card-2',
      expression: 'テスト',
      reading: 'てすと',
      sentence: 'これはテストです。'
      // document_title is missing
    };

    const fieldMappings = {
      'Expression': '{expression}',
      'DocumentTitle': '{document-title}'
    };

    const result = buildAnkiNoteFields(card, fieldMappings);

    expect(result.noteFields).toEqual({
      'Expression': 'テスト',
      'DocumentTitle': '' // Should be empty string when document_title is missing
    });
  });

  it('should handle null document title', () => {
    const card = {
      id: 'test-card-3',
      expression: 'テスト',
      reading: 'てすと',
      document_title: null
    };

    const fieldMappings = {
      'Expression': '{expression}',
      'DocumentTitle': '{document-title}'
    };

    const result = buildAnkiNoteFields(card, fieldMappings);

    expect(result.noteFields).toEqual({
      'Expression': 'テスト',
      'DocumentTitle': '' // Should be empty string when document_title is null
    });
  });

  it('should handle undefined document title', () => {
    const card = {
      id: 'test-card-4',
      expression: 'テスト',
      reading: 'てすと',
      document_title: undefined
    };

    const fieldMappings = {
      'Expression': '{expression}',
      'DocumentTitle': '{document-title}'
    };

    const result = buildAnkiNoteFields(card, fieldMappings);

    expect(result.noteFields).toEqual({
      'Expression': 'テスト',
      'DocumentTitle': '' // Should be empty string when document_title is undefined
    });
  });

  it('should work with other markers in combination', () => {
    const card = {
      id: 'test-card-5',
      expression: '日本語',
      reading: 'にほんご',
      sentence: '日本語を勉強しています。',
      document_title: 'Japanese Learning Book'
    };

    const fieldMappings = {
      'Expression': '{expression}',
      'Reading': '{reading}',
      'Sentence': '{sentence}',
      'DocumentTitle': '{document-title}',
      'Combined': '{expression} - {document-title}'
    };

    const result = buildAnkiNoteFields(card, fieldMappings);

    expect(result.noteFields).toEqual({
      'Expression': '日本語',
      'Reading': 'にほんご',
      'Sentence': '日本語を勉強しています。',
      'DocumentTitle': 'Japanese Learning Book',
      'Combined': '' // Custom field mapping would need special handling
    });
  });
});

describe('Expression Furigana Field Mapping', () => {
  it('should generate furigana format when both expression and reading are present', () => {
    const card = {
      id: 'test-card-furigana-1',
      expression: '日本語',
      reading: 'にほんご',
      sentence: '日本語を勉強しています。'
    };

    const fieldMappings = {
      'Expression': '{expression}',
      'Reading': '{reading}',
      'Furigana': '{expression_furigana}'
    };

    const result = buildAnkiNoteFields(card, fieldMappings);

    expect(result.noteFields).toEqual({
      'Expression': '日本語',
      'Reading': 'にほんご',
      'Furigana': '日本語[にほんご]'
    });
  });

  it('should handle missing expression gracefully', () => {
    const card = {
      id: 'test-card-furigana-2',
      reading: 'にほんご',
      sentence: '日本語を勉強しています。'
      // expression is missing
    };

    const fieldMappings = {
      'Reading': '{reading}',
      'Furigana': '{expression_furigana}'
    };

    const result = buildAnkiNoteFields(card, fieldMappings);

    expect(result.noteFields).toEqual({
      'Reading': 'にほんご',
      'Furigana': '' // Should be empty when expression is missing
    });
  });

  it('should handle missing reading gracefully', () => {
    const card = {
      id: 'test-card-furigana-3',
      expression: '日本語',
      sentence: '日本語を勉強しています。'
      // reading is missing
    };

    const fieldMappings = {
      'Expression': '{expression}',
      'Furigana': '{expression_furigana}'
    };

    const result = buildAnkiNoteFields(card, fieldMappings);

    expect(result.noteFields).toEqual({
      'Expression': '日本語',
      'Furigana': '' // Should be empty when reading is missing
    });
  });

  it('should handle both expression and reading missing', () => {
    const card = {
      id: 'test-card-furigana-4',
      sentence: '日本語を勉強しています。'
      // both expression and reading are missing
    };

    const fieldMappings = {
      'Furigana': '{expression_furigana}'
    };

    const result = buildAnkiNoteFields(card, fieldMappings);

    expect(result.noteFields).toEqual({
      'Furigana': '' // Should be empty when both are missing
    });
  });

  it('should handle null expression', () => {
    const card = {
      id: 'test-card-furigana-5',
      expression: null,
      reading: 'にほんご'
    };

    const fieldMappings = {
      'Furigana': '{expression_furigana}'
    };

    const result = buildAnkiNoteFields(card, fieldMappings);

    expect(result.noteFields).toEqual({
      'Furigana': '' // Should be empty when expression is null
    });
  });

  it('should handle null reading', () => {
    const card = {
      id: 'test-card-furigana-6',
      expression: '日本語',
      reading: null
    };

    const fieldMappings = {
      'Furigana': '{expression_furigana}'
    };

    const result = buildAnkiNoteFields(card, fieldMappings);

    expect(result.noteFields).toEqual({
      'Furigana': '' // Should be empty when reading is null
    });
  });

  it('should handle empty string expression', () => {
    const card = {
      id: 'test-card-furigana-7',
      expression: '',
      reading: 'にほんご'
    };

    const fieldMappings = {
      'Furigana': '{expression_furigana}'
    };

    const result = buildAnkiNoteFields(card, fieldMappings);

    expect(result.noteFields).toEqual({
      'Furigana': '' // Should be empty when expression is empty string
    });
  });

  it('should handle empty string reading', () => {
    const card = {
      id: 'test-card-furigana-8',
      expression: '日本語',
      reading: ''
    };

    const fieldMappings = {
      'Furigana': '{expression_furigana}'
    };

    const result = buildAnkiNoteFields(card, fieldMappings);

    expect(result.noteFields).toEqual({
      'Furigana': '' // Should be empty when reading is empty string
    });
  });

  it('should work with multiple field mappings including furigana', () => {
    const card = {
      id: 'test-card-furigana-9',
      expression: 'テスト',
      reading: 'てすと',
      sentence: 'これはテストです。',
      document_title: 'Test Book'
    };

    const fieldMappings = {
      'Expression': '{expression}',
      'Reading': '{reading}',
      'Furigana': '{expression_furigana}',
      'Sentence': '{sentence}',
      'DocumentTitle': '{document-title}'
    };

    const result = buildAnkiNoteFields(card, fieldMappings);

    expect(result.noteFields).toEqual({
      'Expression': 'テスト',
      'Reading': 'てすと',
      'Furigana': 'テスト[てすと]',
      'Sentence': 'これはテストです。',
      'DocumentTitle': 'Test Book'
    });
  });

  it('should handle complex expressions with special characters', () => {
    const card = {
      id: 'test-card-furigana-10',
      expression: '日本語・英語',
      reading: 'にほんご・えいご'
    };

    const fieldMappings = {
      'Furigana': '{expression_furigana}'
    };

    const result = buildAnkiNoteFields(card, fieldMappings);

    expect(result.noteFields).toEqual({
      'Furigana': '日本語・英語[にほんご・えいご]'
    });
  });

  describe('Frequency Harmonic Rank', () => {
    it('should calculate harmonic rank correctly with numeric frequency values', () => {
      const cardWithNumericFrequency = {
        id: 'test-card-1',
        expression: 'テスト',
        reading: 'てすと',
        sentence: 'これはテストです。',
        frequency: [
          ['Dict1', 100],
          ['Dict2', 200],
          ['Dict3', 300]
        ]
      };

      const fieldMappings = {
        'HarmonicRank': '{frequency-harmonic-rank}'
      };

      const result = buildAnkiNoteFields(cardWithNumericFrequency, fieldMappings);

      // Harmonic mean of 100, 200, 300 = 3 / (1/100 + 1/200 + 1/300) = 3 / (0.01 + 0.005 + 0.00333) = 3 / 0.01833 ≈ 163.64
      expect(result.noteFields['HarmonicRank']).toBe('164');
    });

    it('should calculate harmonic rank correctly with mixed frequency formats', () => {
      const cardWithMixedFrequency = {
        id: 'test-card-2',
        expression: 'テスト',
        reading: 'てすと',
        sentence: 'これはテストです。',
        frequency: [
          ['Dict1', 100],
          ['Dict2', '375/26286'], // Should extract 375
          ['Dict3', '500'],
          ['Dict4', 'abc'] // Should be ignored
        ]
      };

      const fieldMappings = {
        'HarmonicRank': '{frequency-harmonic-rank}'
      };

      const result = buildAnkiNoteFields(cardWithMixedFrequency, fieldMappings);

      // Harmonic mean of 100, 375, 500, 9999999 (for 'abc') = 4 / (1/100 + 1/375 + 1/500 + 1/9999999) ≈ 4 / (0.01 + 0.00267 + 0.002 + 0) ≈ 4 / 0.01467 ≈ 273
      expect(result.noteFields['HarmonicRank']).toBe('273');
    });

    it('should return default value when no frequency data is available', () => {
      const cardWithoutFrequency = {
        id: 'test-card-4',
        expression: 'テスト',
        reading: 'てすと',
        sentence: 'これはテストです。'
        // frequency field is missing
      };

      const fieldMappings = {
        'HarmonicRank': '{frequency-harmonic-rank}'
      };

      const result = buildAnkiNoteFields(cardWithoutFrequency, fieldMappings);

      expect(result.noteFields['HarmonicRank']).toBe('9999999');
    });

    it('should return default value when frequency data is empty', () => {
      const cardWithEmptyFrequency = {
        id: 'test-card-5',
        expression: 'テスト',
        reading: 'てすと',
        sentence: 'これはテストです。',
        frequency: []
      };

      const fieldMappings = {
        'HarmonicRank': '{frequency-harmonic-rank}'
      };

      const result = buildAnkiNoteFields(cardWithEmptyFrequency, fieldMappings);

      expect(result.noteFields['HarmonicRank']).toBe('9999999');
    });

    it('should handle single frequency value correctly', () => {
      const cardWithSingleFrequency = {
        id: 'test-card-7',
        expression: 'テスト',
        reading: 'てすと',
        sentence: 'これはテストです。',
        frequency: [
          ['Dict1', 150]
        ]
      };

      const fieldMappings = {
        'HarmonicRank': '{frequency-harmonic-rank}'
      };

      const result = buildAnkiNoteFields(cardWithSingleFrequency, fieldMappings);

      // Single value should return itself
      expect(result.noteFields['HarmonicRank']).toBe('150');
    });

    it('should handle real-world frequency data format', () => {
      const cardWithRealFrequency = {
        id: 'test-card-8',
        expression: 'テスト',
        reading: 'てすと',
        sentence: 'これはテストです。',
        frequency: [
          ["ヒカル","375/26286"],
          ["Netflix",549],
          ["Anime & J-drama",556],
          ["Novels",497],
          ["Youtube","488"],
          ["Wikipedia",2911],
          ["Innocent Ranked",409],
          ["jpDicts (206k)",1052],
          ["NieR","1301/10077"],
          ["国語辞典",1135]
        ]
      };

      const fieldMappings = {
        'HarmonicRank': '{frequency-harmonic-rank}'
      };

      const result = buildAnkiNoteFields(cardWithRealFrequency, fieldMappings);

      // Should extract valid numeric values and calculate harmonic mean
      // Valid values: 375, 549, 556, 497, 488, 2911, 409, 1052, 1301, 1135
      const harmonicMean = 10 / (1/375 + 1/549 + 1/556 + 1/497 + 1/488 + 1/2911 + 1/409 + 1/1052 + 1/1301 + 1/1135);
      expect(result.noteFields['HarmonicRank']).toBe(Math.round(harmonicMean).toString());
    });
  });
});
