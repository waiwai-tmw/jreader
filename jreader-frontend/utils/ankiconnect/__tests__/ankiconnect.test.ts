import { generateAnkiImageFilename, planAnkiAudioFilename, syncCardsToAnki } from '../ankiconnect';

// Mock the anki-fmt module
jest.mock('../anki-fmt', () => ({
  buildAnkiNoteFields: jest.fn((card, _fieldMappings) => ({
    noteFields: { 
      Word: card.word || 'test',
      Sentence: card.sentence || 'test sentence'
    },
    audioFields: card.audioUrl ? { Audio: card.audioUrl } : {},
    imageFields: card.imagePath ? { Image: card.imagePath } : {},
  })),
}));

describe('ankiconnect', () => {
  describe('generateAnkiImageFilename', () => {
    describe('extension handling edge cases', () => {
      it('should preserve file extension when present', () => {
        const result = generateAnkiImageFilename('MyDict', 'path/to/image.png');
        expect(result).toBe('jreader_MyDict_path_to_image.png');
      });

      it('should handle missing extension gracefully', () => {
        const result = generateAnkiImageFilename('MyDict', 'path/to/image');
        expect(result).toBe('jreader_MyDict_path_to_image');
      });

      it('should handle path with only extension (no base name)', () => {
        const result = generateAnkiImageFilename('MyDict', '.png');
        expect(result).toBe('jreader_MyDict_.png');
      });

      it('should handle empty path', () => {
        const result = generateAnkiImageFilename('MyDict', '');
        expect(result).toBe('jreader_MyDict_');
      });

      it('should handle multiple dots in filename (uses last dot for extension)', () => {
        const result = generateAnkiImageFilename('MyDict', 'path/image.final.png');
        expect(result).toBe('jreader_MyDict_path_image_final.png');
      });

      it('should handle extension at path level', () => {
        const result = generateAnkiImageFilename('MyDict', 'path.with.dots/image.jpg');
        expect(result).toBe('jreader_MyDict_path_with_dots_image.jpg');
      });
    });

    describe('special character handling', () => {
      it('should sanitize filesystem-problematic characters in dictionary name', () => {
        const result = generateAnkiImageFilename('My<Dict>:Name|With?*Chars', 'image.png');
        expect(result).toBe('jreader_My_Dict_Name_With_Chars_image.png');
      });

      it('should sanitize slashes and backslashes', () => {
        const result = generateAnkiImageFilename('My/Dict\\Name', 'path/to/image.png');
        expect(result).toBe('jreader_My_Dict_Name_path_to_image.png');
      });

      it('should replace brackets and parentheses', () => {
        const result = generateAnkiImageFilename('Dict[v2](2024)', 'path/image.png');
        expect(result).toBe('jreader_Dict_v2_2024_path_image.png');
      });

      it('should collapse multiple underscores', () => {
        const result = generateAnkiImageFilename('My___Dict___Name', 'image.png');
        expect(result).toBe('jreader_My_Dict_Name_image.png');
      });

      it('should remove leading and trailing underscores', () => {
        const result = generateAnkiImageFilename('_MyDict_', '_image_.png');
        expect(result).toBe('jreader_MyDict_image.png');
      });

      it('should handle whitespace in paths', () => {
        const result = generateAnkiImageFilename('My Dict', 'path with spaces/image name.png');
        expect(result).toBe('jreader_My_Dict_path_with_spaces_image_name.png');
      });
    });

    describe('dictionary prefix handling', () => {
      it('should strip dictionary name prefix when present in path', () => {
        const result = generateAnkiImageFilename('MyDict', 'MyDict/subpath/image.png');
        expect(result).toBe('jreader_MyDict_subpath_image.png');
      });

      it('should not strip when dictionary name is not at the start', () => {
        const result = generateAnkiImageFilename('MyDict', 'other/MyDict/image.png');
        expect(result).toBe('jreader_MyDict_other_MyDict_image.png');
      });

      it('should handle single-part path (no slashes)', () => {
        const result = generateAnkiImageFilename('MyDict', 'image.png');
        expect(result).toBe('jreader_MyDict_image.png');
      });
    });

    describe('complex real-world scenarios', () => {
      it('should handle Japanese dictionary with complex path', () => {
        const result = generateAnkiImageFilename(
          '大辞林 (Daijirin)',
          '大辞林 (Daijirin)/images/漢字.png'
        );
        expect(result).toBe('jreader_大辞林_Daijirin_images_漢字.png');
      });

      it('should handle URL-like paths', () => {
        const result = generateAnkiImageFilename(
          'MyDict',
          'MyDict/https://example.com/image.png'
        );
        expect(result).toBe('jreader_MyDict_https_example_com_image.png');
      });

      it('should handle deeply nested paths', () => {
        const result = generateAnkiImageFilename(
          'MyDict',
          'MyDict/level1/level2/level3/level4/image.png'
        );
        expect(result).toBe('jreader_MyDict_level1_level2_level3_level4_image.png');
      });
    });
  });

  describe('planAnkiAudioFilename', () => {
    it('should generate a canonicalized filename from the audio path', () => {
      const result = planAnkiAudioFilename(123, '/media/jpod_files/media/28b166c240f976e72e5481b3565f3397.mp3');
      expect(result).toBe('jreader_media_jpod_files_media_28b166c240f976e72e5481b3565f3397.mp3');
    });
  });

  describe('syncCardsToAnki with audio edge cases', () => {
    // Mock console.warn to capture warnings
    const originalWarn = console.warn;
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
      warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
      console.warn = originalWarn;
    });

    describe('audio extension validation', () => {
      it('should warn when audio extension is not mp3 (opus)', async () => {
        const cards = [{
          id: 123,
          word: 'test',
          audioUrl: 'https://example.com/audio.opus'
        }];
        
        const ankiSettings = {
          anki_connect_url: 'http://localhost:8765',
          anki_deck: 'TestDeck',
          anki_note_type: 'Basic'
        };

        await syncCardsToAnki(cards, ankiSettings, {});
        
        expect(warnSpy).toHaveBeenCalledWith(
          '🎵 Unexpected audio extension for card id:',
          123,
          ':',
          'opus'
        );
      });

      it('should warn when audio extension is not mp3 (ogg)', async () => {
        const cards = [{
          id: 456,
          word: 'test',
          audioUrl: 'https://example.com/audio.ogg'
        }];
        
        const ankiSettings = {
          anki_connect_url: 'http://localhost:8765',
          anki_deck: 'TestDeck',
          anki_note_type: 'Basic'
        };

        await syncCardsToAnki(cards, ankiSettings, {});
        
        expect(warnSpy).toHaveBeenCalledWith(
          '🎵 Unexpected audio extension for card id:',
          456,
          ':',
          'ogg'
        );
      });

      it('should not warn for mp3 files', async () => {
        const cards = [{
          id: 789,
          word: 'test',
          audioUrl: 'https://example.com/audio.mp3'
        }];
        
        const ankiSettings = {
          anki_connect_url: 'http://localhost:8765',
          anki_deck: 'TestDeck',
          anki_note_type: 'Basic'
        };

        await syncCardsToAnki(cards, ankiSettings, {});
        
        expect(warnSpy).not.toHaveBeenCalled();
      });

      it('should handle case-insensitive mp3 extension (MP3)', async () => {
        const cards = [{
          id: 101,
          word: 'test',
          audioUrl: 'https://example.com/audio.MP3'
        }];
        
        const ankiSettings = {
          anki_connect_url: 'http://localhost:8765',
          anki_deck: 'TestDeck',
          anki_note_type: 'Basic'
        };

        await syncCardsToAnki(cards, ankiSettings, {});
        
        expect(warnSpy).not.toHaveBeenCalled();
      });

      it('should handle audio URLs with query parameters', async () => {
        const cards = [{
          id: 202,
          word: 'test',
          audioUrl: 'https://example.com/audio.opus?version=2&quality=high'
        }];
        
        const ankiSettings = {
          anki_connect_url: 'http://localhost:8765',
          anki_deck: 'TestDeck',
          anki_note_type: 'Basic'
        };

        await syncCardsToAnki(cards, ankiSettings, {});
        
        expect(warnSpy).toHaveBeenCalledWith(
          '🎵 Unexpected audio extension for card id:',
          202,
          ':',
          'opus'
        );
      });

      it('should handle audio URLs with fragments', async () => {
        const cards = [{
          id: 303,
          word: 'test',
          audioUrl: 'https://example.com/audio.ogg#t=10'
        }];
        
        const ankiSettings = {
          anki_connect_url: 'http://localhost:8765',
          anki_deck: 'TestDeck',
          anki_note_type: 'Basic'
        };

        await syncCardsToAnki(cards, ankiSettings, {});
        
        expect(warnSpy).toHaveBeenCalledWith(
          '🎵 Unexpected audio extension for card id:',
          303,
          ':',
          'ogg'
        );
      });

      it('should warn for audio URLs without proper extension (domain as extension)', async () => {
        const cards = [{
          id: 404,
          word: 'test',
          audioUrl: 'https://example.com/audio'
        }];
        
        const ankiSettings = {
          anki_connect_url: 'http://localhost:8765',
          anki_deck: 'TestDeck',
          anki_note_type: 'Basic'
        };

        await syncCardsToAnki(cards, ankiSettings, {});
        
        // URL without extension extracts 'com/audio' as the "extension" due to .com in domain
        expect(warnSpy).toHaveBeenCalledWith(
          '🎵 Unexpected audio extension for card id:',
          404,
          ':',
          'com/audio'
        );
      });

      it('should not process empty audio URL (no audioFields created)', async () => {
        const cards = [{
          id: 505,
          word: 'test',
          audioUrl: ''
        }];
        
        const ankiSettings = {
          anki_connect_url: 'http://localhost:8765',
          anki_deck: 'TestDeck',
          anki_note_type: 'Basic'
        };

        await syncCardsToAnki(cards, ankiSettings, {});
        
        // Empty string is falsy, so no audio field is created and no warning is triggered
        expect(warnSpy).not.toHaveBeenCalled();
      });
    });

    describe('audio filename generation', () => {
      it('should always use .mp3 extension regardless of source', async () => {
        // Put a forward slash in the audioUrl path to test the canonicalization
        const cards = [{
          id: 606,
          word: 'test',
          audioUrl: '/media/shinmeikai8_files\\media/50464.opus'
        }];

        const ankiSettings = {
          anki_connect_url: 'http://localhost:8765',
          anki_deck: 'TestDeck',
          anki_note_type: 'Basic'
        };

        const result = await syncCardsToAnki(cards, ankiSettings, {});

        expect(result.mediaPlans[0]!.audioToUpload[0]!.ankiFilename).toBe('jreader_media_shinmeikai8_files_media_50464.mp3');
      });

      it('should use card id in filename', async () => {
        const cards = [{
          id: 999999,
          word: 'test',
          audioUrl: '/media/shinmeikai8_files/media/50464.opus'
        }];
        
        const ankiSettings = {
          anki_connect_url: 'http://localhost:8765',
          anki_deck: 'TestDeck',
          anki_note_type: 'Basic'
        };

        const result = await syncCardsToAnki(cards, ankiSettings, {});

        expect(result.mediaPlans[0]!.audioToUpload[0]!.ankiFilename).toBe('jreader_media_shinmeikai8_files_media_50464.mp3');
      });
    });
  });

  describe('syncCardsToAnki basic functionality', () => {
    it('should handle empty cards array', async () => {
      const ankiSettings = {
        anki_connect_url: 'http://localhost:8765',
        anki_deck: 'TestDeck',
        anki_note_type: 'Basic'
      };

      const result = await syncCardsToAnki([], ankiSettings, {});
      
      expect(result.addNotesRequest.params.notes).toEqual([]);
      expect(result.mediaPlans).toEqual([]);
    });

    it('should create proper addNotes request structure', async () => {
      const cards = [{
        id: 1,
        word: 'test',
        sentence: 'This is a test'
      }];
      
      const ankiSettings = {
        anki_connect_url: 'http://localhost:8765',
        anki_deck: 'MyDeck',
        anki_note_type: 'MyNoteType'
      };

      const result = await syncCardsToAnki(cards, ankiSettings, {});
      
      expect(result.addNotesRequest).toEqual({
        action: 'addNotes',
        version: 6,
        params: {
          notes: [{
            deckName: 'MyDeck',
            modelName: 'MyNoteType',
            fields: {
              Word: 'test',
              Sentence: 'This is a test'
            },
            tags: ['jreader']
          }]
        }
      });
    });
  });
});

