import {
  generateAnkiImageFilename,
} from '@/utils/ankiconnect/ankiconnect';

describe('Image Sync Helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('planAnkiImageFilename', () => {
    it('should generate correct filename for simple dictionary and path', () => {
      const result = generateAnkiImageFilename('Test Dictionary', 'assets/image.png');
      expect(result).toBe('jreader_Test_Dictionary_assets_image.png');
    });

    it('should handle dictionary names with special characters', () => {
      const result = generateAnkiImageFilename('ja.Wikipedia.2022-12-01.v1.6.1', 'img/logo.png');
      expect(result).toBe('jreader_ja_Wikipedia_2022-12-01_v1_6_1_img_logo.png');
    });

    it('should handle Japanese characters in dictionary names', () => {
      const result = generateAnkiImageFilename('日本語辞書', '画像/魚.png');
      expect(result).toBe('jreader_日本語辞書_画像_魚.png');
    });

    it('should handle complex paths with multiple special characters', () => {
      const result = generateAnkiImageFilename('PixivLight_2024-11-25', 'assets/pixiv-logo.png');
      expect(result).toBe('jreader_PixivLight_2024-11-25_assets_pixiv-logo.png');
    });

    it('should handle paths with problematic filesystem characters', () => {
      const result = generateAnkiImageFilename('Test Dict', 'folder<with>special:chars|file.png');
      expect(result).toBe('jreader_Test_Dict_folder_with_special_chars_file.png');
    });

    it('should handle multiple consecutive underscores', () => {
      const result = generateAnkiImageFilename('Test___Dict', 'path//with//slashes.png');
      expect(result).toBe('jreader_Test_Dict_path_with_slashes.png');
    });
  });

});
