import { frequencyHarmonicRank, extractFrequencyRanks, formatFrequencyList } from '@/utils/ankiconnect/frequencyUtils';

describe('frequencyHarmonicRank', () => {
  it('should calculate harmonic mean correctly with simple numeric values', () => {
    const ranks = [100, 200, 300];
    const result = frequencyHarmonicRank(ranks);
    
    // Harmonic mean = 3 / (1/100 + 1/200 + 1/300) = 3 / (0.01 + 0.005 + 0.00333) = 3 / 0.01833 ≈ 163.64
    expect(result).toBe(164);
  });

  it('should handle null values by treating them as 9999999', () => {
    const ranks = [100, null, 300];
    const result = frequencyHarmonicRank(ranks);
    
    // Harmonic mean = 3 / (1/100 + 1/9999999 + 1/300) ≈ 3 / (0.01 + 0 + 0.00333) = 3 / 0.01333 ≈ 225
    expect(result).toBe(225);
  });

  it('should handle undefined values by treating them as 9999999', () => {
    const ranks = [100, undefined, 300];
    const result = frequencyHarmonicRank(ranks);
    
    // Same calculation as null case
    expect(result).toBe(225);
  });

  it('should handle mixed null and undefined values', () => {
    const ranks = [100, null, undefined, 300];
    const result = frequencyHarmonicRank(ranks);
    
    // Harmonic mean = 4 / (1/100 + 1/9999999 + 1/9999999 + 1/300) ≈ 4 / (0.01 + 0 + 0 + 0.00333) = 4 / 0.01333 ≈ 300
    expect(result).toBe(300);
  });

  it('should return 9999999 for empty array', () => {
    const ranks: (number | null | undefined)[] = [];
    const result = frequencyHarmonicRank(ranks);
    
    expect(result).toBe(9999999);
  });

  it('should handle single value correctly', () => {
    const ranks = [150];
    const result = frequencyHarmonicRank(ranks);
    
    // Single value should return itself
    expect(result).toBe(150);
  });

  it('should handle all null values', () => {
    const ranks = [null, null, null];
    const result = frequencyHarmonicRank(ranks);
    
    // All values become 9999999, harmonic mean = 3 / (3/9999999) = 9999999
    expect(result).toBe(9999999);
  });

  it('should handle large numbers correctly', () => {
    const ranks = [1000000, 2000000, 3000000];
    const result = frequencyHarmonicRank(ranks);
    
    // Harmonic mean = 3 / (1/1000000 + 1/2000000 + 1/3000000) = 3 / (0.000001 + 0.0000005 + 0.000000333) = 3 / 0.000001833 ≈ 1,636,364
    expect(result).toBe(1636364);
  });
});

describe('extractFrequencyRanks', () => {
  it('should extract numeric values from frequency data pairs', () => {
    const frequencyData = [
      ['Dict1', 100],
      ['Dict2', 200],
      ['Dict3', 300]
    ];
    
    const result = extractFrequencyRanks(frequencyData);
    expect(result).toEqual([100, 200, 300]);
  });

  it('should handle string values like "375/26286" by extracting numerator', () => {
    const frequencyData = [
      ['Dict1', 100],
      ['Dict2', '375/26286'], // Should extract 375
      ['Dict3', 300]
    ];
    
    const result = extractFrequencyRanks(frequencyData);
    expect(result).toEqual([100, 375, 300]);
  });

  it('should handle string numbers', () => {
    const frequencyData = [
      ['Dict1', '100'],
      ['Dict2', '200'],
      ['Dict3', '300']
    ];
    
    const result = extractFrequencyRanks(frequencyData);
    expect(result).toEqual([100, 200, 300]);
  });

  it('should handle mixed valid and invalid values', () => {
    const frequencyData = [
      ['Dict1', 100],
      ['Dict2', 'abc'], // Invalid - should become null
      ['Dict3', 300],
      ['Dict4', 0], // Invalid - should become null
      ['Dict5', -50] // Invalid - should become null
    ];
    
    const result = extractFrequencyRanks(frequencyData);
    expect(result).toEqual([100, null, 300, null, null]);
  });

  it('should handle non-array frequency data', () => {
    const result1 = extractFrequencyRanks(null as any);
    const result2 = extractFrequencyRanks(undefined as any);
    const result3 = extractFrequencyRanks('not an array' as any);
    
    expect(result1).toEqual([]);
    expect(result2).toEqual([]);
    expect(result3).toEqual([]);
  });

  it('should handle empty frequency data', () => {
    const frequencyData: any[] = [];
    const result = extractFrequencyRanks(frequencyData);
    
    expect(result).toEqual([]);
  });

  it('should handle malformed frequency pairs', () => {
    const frequencyData = [
      ['Dict1', 100], // Valid
      ['Dict2'], // Missing frequency value
      ['Dict3', 200], // Valid
      ['Dict4', '300', 'extra'], // Extra value (should still work)
      'not an array', // Invalid pair
      ['Dict5', 400] // Valid
    ];
    
    const result = extractFrequencyRanks(frequencyData);
    expect(result).toEqual([100, 200, 300, 400]); // All valid pairs are processed (including ['Dict4', '300', 'extra'])
  });

  it('should handle fraction format with zero numerator', () => {
    const frequencyData = [
      ['Dict1', '0/1000'], // Should become null
      ['Dict2', '100/1000'] // Should extract 100
    ];
    
    const result = extractFrequencyRanks(frequencyData);
    expect(result).toEqual([null, 100]);
  });

  it('should handle negative numbers', () => {
    const frequencyData = [
      ['Dict1', -100], // Should become null
      ['Dict2', 200], // Valid
      ['Dict3', '-300'] // Should become null
    ];
    
    const result = extractFrequencyRanks(frequencyData);
    expect(result).toEqual([null, 200, null]);
  });

  it('should handle decimal string numbers', () => {
    const frequencyData = [
      ['Dict1', '100.5'], // Should extract 100.5
      ['Dict2', '200.0'], // Should extract 200
      ['Dict3', '300.999'] // Should extract 300.999
    ];
    
    const result = extractFrequencyRanks(frequencyData);
    expect(result).toEqual([100.5, 200, 300.999]);
  });

  it('should handle real-world frequency data format', () => {
    const frequencyData = [
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
    ];
    
    const result = extractFrequencyRanks(frequencyData);
    
    // Should extract: 375, 549, 556, 497, 488, 2911, 409, 1052, 1301, 1135
    expect(result).toEqual([375, 549, 556, 497, 488, 2911, 409, 1052, 1301, 1135]);
  });
});

describe('formatFrequencyList', () => {
  it('should format numeric frequency values as HTML list', () => {
    const frequencyData = [
      ['Dict1', 100],
      ['Dict2', 200],
      ['Dict3', 300]
    ];
    
    const result = formatFrequencyList(frequencyData);
    expect(result).toBe('<ul style="text-align: left;"><li>Dict1: 100</li><li>Dict2: 200</li><li>Dict3: 300</li></ul>');
  });

  it('should format large numeric values with commas', () => {
    const frequencyData = [
      ['Dict1', 19548],
      ['Dict2', 2013],
      ['Dict3', 6331]
    ];
    
    const result = formatFrequencyList(frequencyData);
    expect(result).toBe('<ul style="text-align: left;"><li>Dict1: 19,548</li><li>Dict2: 2,013</li><li>Dict3: 6,331</li></ul>');
  });

  it('should handle string frequency values as-is', () => {
    const frequencyData = [
      ['Dict1', '375/26286'],
      ['Dict2', 'abc'],
      ['Dict3', '100']
    ];
    
    const result = formatFrequencyList(frequencyData);
    expect(result).toBe('<ul style="text-align: left;"><li>Dict1: 375/26286</li><li>Dict2: abc</li><li>Dict3: 100</li></ul>');
  });

  it('should handle mixed numeric and string values', () => {
    const frequencyData = [
      ['Dict1', 100],
      ['Dict2', '375/26286'],
      ['Dict3', 200]
    ];
    
    const result = formatFrequencyList(frequencyData);
    expect(result).toBe('<ul style="text-align: left;"><li>Dict1: 100</li><li>Dict2: 375/26286</li><li>Dict3: 200</li></ul>');
  });

  it('should handle non-string/non-number values', () => {
    const frequencyData = [
      ['Dict1', 100],
      ['Dict2', null],
      ['Dict3', true],
      ['Dict4', 200]
    ];
    
    const result = formatFrequencyList(frequencyData);
    expect(result).toBe('<ul style="text-align: left;"><li>Dict1: 100</li><li>Dict2: null</li><li>Dict3: true</li><li>Dict4: 200</li></ul>');
  });

  it('should return empty string for null/undefined input', () => {
    const result1 = formatFrequencyList(null as any);
    const result2 = formatFrequencyList(undefined as any);
    
    expect(result1).toBe('');
    expect(result2).toBe('');
  });

  it('should return empty string for non-array input', () => {
    const result = formatFrequencyList('not an array' as any);
    expect(result).toBe('');
  });

  it('should return empty string for empty array', () => {
    const result = formatFrequencyList([]);
    expect(result).toBe('');
  });

  it('should filter out malformed frequency pairs', () => {
    const frequencyData = [
      ['Dict1', 100], // Valid
      ['Dict2'], // Missing frequency value
      ['Dict3', 200], // Valid
      'not an array', // Invalid pair
      ['Dict4', 300] // Valid
    ];
    
    const result = formatFrequencyList(frequencyData);
    expect(result).toBe('<ul style="text-align: left;"><li>Dict1: 100</li><li>Dict3: 200</li><li>Dict4: 300</li></ul>');
  });

  it('should handle pairs with extra values', () => {
    const frequencyData = [
      ['Dict1', 100, 'extra'], // Should still work
      ['Dict2', 200]
    ];
    
    const result = formatFrequencyList(frequencyData);
    expect(result).toBe('<ul style="text-align: left;"><li>Dict1: 100</li><li>Dict2: 200</li></ul>');
  });

  it('should handle real-world frequency data format', () => {
    const frequencyData = [
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
    ];
    
    const result = formatFrequencyList(frequencyData);
    
    expect(result).toContain('<ul style="text-align: left;">');
    expect(result).toContain('<li>ヒカル: 375/26286</li>');
    expect(result).toContain('<li>Netflix: 549</li>');
    expect(result).toContain('<li>Wikipedia: 2,911</li>');
    expect(result).toContain('<li>jpDicts (206k): 1,052</li>');
    expect(result).toContain('<li>国語辞典: 1,135</li>');
    expect(result).toContain('</ul>');
  });

  it('should handle zero and negative numbers', () => {
    const frequencyData = [
      ['Dict1', 0],
      ['Dict2', -100],
      ['Dict3', 200]
    ];
    
    const result = formatFrequencyList(frequencyData);
    expect(result).toBe('<ul style="text-align: left;"><li>Dict1: 0</li><li>Dict2: -100</li><li>Dict3: 200</li></ul>');
  });

  it('should handle decimal numbers', () => {
    const frequencyData = [
      ['Dict1', 100.5],
      ['Dict2', 200.0],
      ['Dict3', 300.999]
    ];
    
    const result = formatFrequencyList(frequencyData);
    expect(result).toBe('<ul style="text-align: left;"><li>Dict1: 100.5</li><li>Dict2: 200</li><li>Dict3: 300.999</li></ul>');
  });
});

