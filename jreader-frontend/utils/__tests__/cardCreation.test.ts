import type { CardCreationData } from '../cardCreation';

describe('Card Creation with Document Title', () => {
  it('should have documentTitle in CardCreationData interface', () => {
    const cardData: CardCreationData = {
      term: 'テスト',
      reading: 'てすと',
      definitions: [{ definition: 'test definition' }],
      sentence: 'これはテストです。',
      pitchAccent: '0',
      frequencyPairs: [],
      expressionAudio: 'audio.mp3',
      documentTitle: 'Sample Book Title'
    };

    expect(cardData.documentTitle).toBe('Sample Book Title');
    expect(cardData.term).toBe('テスト');
    expect(cardData.reading).toBe('てすと');
  });

  it('should allow documentTitle to be undefined', () => {
    const cardData: CardCreationData = {
      term: 'テスト',
      reading: 'てすと',
      definitions: [{ definition: 'test definition' }],
      sentence: 'これはテストです。',
      pitchAccent: '0',
      frequencyPairs: [],
      expressionAudio: 'audio.mp3'
      // documentTitle is optional
    };

    expect(cardData.documentTitle).toBeUndefined();
    expect(cardData.term).toBe('テスト');
  });

  it('should allow documentTitle to be null', () => {
    const cardData: CardCreationData = {
      term: 'テスト',
      reading: 'てすと',
      definitions: [{ definition: 'test definition' }],
      sentence: 'これはテストです。',
      pitchAccent: '0',
      frequencyPairs: [],
      expressionAudio: 'audio.mp3',
      documentTitle: undefined
    };

    expect(cardData.documentTitle).toBeUndefined();
    expect(cardData.term).toBe('テスト');
  });

  it('should handle empty string document title', () => {
    const cardData: CardCreationData = {
      term: 'テスト',
      reading: 'てすと',
      definitions: [{ definition: 'test definition' }],
      sentence: 'これはテストです。',
      pitchAccent: '0',
      frequencyPairs: [],
      expressionAudio: 'audio.mp3',
      documentTitle: ''
    };

    expect(cardData.documentTitle).toBe('');
    expect(cardData.term).toBe('テスト');
  });
});