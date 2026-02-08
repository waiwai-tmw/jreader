import { getMainDefinition, getGlossary } from '@/utils/ankiconnect/definitionProcessing';

describe('Dual Dictionary Fields', () => {
  it('should use dictionary_title for display and dictionary_origin for image paths', () => {
    const definitions = [{
      type: 'structured',
      content: [
        {
          tag: 'div',
          content: [
            {
              tag: 'img',
              path: 'img/test-image.png',
              height: 10,
              sizeUnits: 'em'
            }
          ]
        }
      ],
      dictionary_title: 'Jitendex.org [2024-11-24]',
      dictionary_origin: 'jitendex-yomitan_2024.11.24.0'
    }];

    const result = getMainDefinition(definitions);

    // Should use dictionary_title for display
    expect(result.html).toContain('data-dictionary="Jitendex.org [2024-11-24]"');
    expect(result.html).toContain('<i>Jitendex.org [2024-11-24]</i>');

    // Should use dictionary_origin for image paths
    const originHash = 'jitendex-yomitan_2024.11.24.0'.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36);
    expect(result.html).toContain(`src="ANKI_IMAGE_PLACEHOLDER_${originHash}_0"`);
    expect(result.imagePaths).toEqual(['jitendex-yomitan_2024.11.24.0/img/test-image.png']);

    // Should have Yomitan-style formatting
    expect(result.html).toContain('class="yomitan-glossary"');
    expect(result.html).toContain('<ol>');
    expect(result.html).toContain('<li data-dictionary="Jitendex.org [2024-11-24]">');
  });

  it('should fall back to dictionary field when dual fields are not available', () => {
    const definitions = [{
      type: 'simple',
      content: 'Simple definition content',
      dictionary: 'Legacy Dictionary Name'
    }];

    const result = getMainDefinition(definitions);

    // Should use the legacy dictionary field for both display and image paths
    expect(result.html).toContain('data-dictionary="Legacy Dictionary Name"');
    expect(result.html).toContain('<i>Legacy Dictionary Name</i>');
  });

  it('should handle glossary with dual dictionary fields', () => {
    const definitions = [
      {
        type: 'simple',
        content: 'First definition',
        dictionary_title: '旺文社国語辞典 第十一版',
        dictionary_origin: 'oubuunsha-kokugo_2024.11.24.0'
      },
      {
        type: 'structured',
        content: '[{"tag":"span","content":"Second definition"}]',
        dictionary_title: '三省堂国語辞典　第八版',
        dictionary_origin: 'sanseido-kokugo_2024.11.24.0'
      }
    ];

    const result = getGlossary(definitions, {});

    // Should use dictionary_title for display
    expect(result.html).toContain('data-dictionary="旺文社国語辞典 第十一版"');
    expect(result.html).toContain('<i>旺文社国語辞典 第十一版</i>');
    expect(result.html).toContain('data-dictionary="三省堂国語辞典　第八版"');
    expect(result.html).toContain('<i>三省堂国語辞典　第八版</i>');

    // Should have Yomitan-style formatting
    expect(result.html).toContain('class="yomitan-glossary"');
    expect(result.html).toContain('<ol>');
    expect(result.html).toContain('<li data-dictionary="旺文社国語辞典 第十一版">');
    expect(result.html).toContain('<li data-dictionary="三省堂国語辞典　第八版">');
  });

  it('should handle mixed dual and legacy dictionary fields', () => {
    const definitions = [
      {
        type: 'simple',
        content: 'New format definition',
        dictionary_title: 'New Dictionary [2024]',
        dictionary_origin: 'new-dict_2024.11.24.0'
      },
      {
        type: 'simple',
        content: 'Legacy format definition',
        dictionary: 'Legacy Dictionary'
      }
    ];

    const result = getGlossary(definitions, {});

    // Should handle both formats correctly
    expect(result.html).toContain('data-dictionary="New Dictionary [2024]"');
    expect(result.html).toContain('<i>New Dictionary [2024]</i>');
    expect(result.html).toContain('data-dictionary="Legacy Dictionary"');
    expect(result.html).toContain('<i>Legacy Dictionary</i>');
  });
});
