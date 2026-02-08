/**
 * Frequency utility functions for calculating harmonic rank and other frequency-related operations
 */

/**
 * Calculate the harmonic mean of frequency rank values for a term.
 * This implements Yomitan's {frequency-harmonic-rank} marker functionality.
 * 
 * @param ranks - Array of frequency rank values (numbers, null, or undefined)
 * @returns The harmonic mean as an integer rank, with null/undefined values treated as 9999999
 * 
 * @example
 * // Numeric rank values
 * const ranks = [100, 200, 300];
 * frequencyHarmonicRank(ranks); // Returns harmonic mean of 100, 200, 300
 * 
 * // Mixed values with nulls
 * const mixedRanks = [100, null, 300, undefined];
 * frequencyHarmonicRank(mixedRanks); // Returns harmonic mean of 100, 9999999, 300, 9999999
 * 
 * // Empty array
 * const emptyRanks = [];
 * frequencyHarmonicRank(emptyRanks); // Returns 9999999
 */
export function frequencyHarmonicRank(ranks: (number | null | undefined)[]): number {
  if (!ranks || ranks.length === 0) {
    return 9999999; // Default value when no rank data is available
  }

  const cleaned = ranks.map(r => (r == null ? 9999999 : r));
  const recipSum = cleaned.reduce((acc, r) => acc + 1 / r, 0);
  return Math.round(cleaned.length / recipSum);
}

/**
 * Extract frequency rank values from card frequency data.
 * This helper function parses various frequency data formats and returns rank values.
 * 
 * @param frequencyData - Array of frequency data pairs [dictionaryName, frequencyValue]
 * @returns Array of frequency rank values (numbers, null, or undefined)
 * 
 * @example
 * // Numeric frequency values
 * const numericFreq = [['Dict1', 100], ['Dict2', 200]];
 * extractFrequencyRanks(numericFreq); // Returns [100, 200]
 * 
 * // Mixed string and numeric values
 * const mixedFreq = [['Dict1', 100], ['Dict2', '375/26286'], ['Dict3', 'abc']];
 * extractFrequencyRanks(mixedFreq); // Returns [100, 375, null]
 */
export function extractFrequencyRanks(frequencyData: any[]): (number | null | undefined)[] {
  if (!frequencyData || !Array.isArray(frequencyData)) {
    return [];
  }

  const ranks: (number | null | undefined)[] = [];
  
  for (const pair of frequencyData) {
    if (Array.isArray(pair) && pair.length >= 2) {
      const [, freqValue] = pair;
      
      // Handle numeric values directly
      if (typeof freqValue === 'number' && freqValue > 0) {
        ranks.push(freqValue);
      }
      // Handle string values like "375/26286" - extract the numerator
      else if (typeof freqValue === 'string') {
        const match = freqValue.match(/^(\d+)\/\d+$/);
        if (match) {
          const numerator = parseInt(match[1], 10);
          if (numerator > 0) {
            ranks.push(numerator);
          } else {
            ranks.push(null);
          }
        }
        // Handle simple string numbers
        else {
          const num = parseFloat(freqValue);
          if (!isNaN(num) && num > 0) {
            ranks.push(num);
          } else {
            ranks.push(null);
          }
        }
      } else {
        ranks.push(null);
      }
    }
  }

  return ranks;
}

/**
 * Format frequency data as HTML list for display in Anki fields.
 * This helper function creates a formatted HTML list from frequency data pairs.
 * 
 * @param frequencyData - Array of frequency data pairs [dictionaryName, frequencyValue]
 * @returns HTML string with formatted frequency list, or empty string if no data
 * 
 * @example
 * // Numeric frequency values
 * const numericFreq = [['Dict1', 100], ['Dict2', 200]];
 * formatFrequencyList(numericFreq); // Returns "<ul style="text-align: left;"><li>Dict1: 100</li><li>Dict2: 200</li></ul>"
 * 
 * // Mixed string and numeric values
 * const mixedFreq = [['Dict1', 100], ['Dict2', '375/26286']];
 * formatFrequencyList(mixedFreq); // Returns "<ul style="text-align: left;"><li>Dict1: 100</li><li>Dict2: 375/26286</li></ul>"
 */
export function formatFrequencyList(frequencyData: any[]): string {
  if (!frequencyData || !Array.isArray(frequencyData) || frequencyData.length === 0) {
    return '';
  }

  const frequencyItems = frequencyData
    .filter((pair: any) => Array.isArray(pair) && pair.length >= 2)
    .map((pair: any) => {
      const [dictName, freqValue] = pair;
      // Handle both numeric and string frequency values
      let displayValue: string;
      if (typeof freqValue === 'number') {
        displayValue = freqValue.toLocaleString();
      } else if (typeof freqValue === 'string') {
        // For string values like "375/26286", keep as-is
        displayValue = freqValue;
      } else {
        displayValue = String(freqValue);
      }
      return `<li>${dictName}: ${displayValue}</li>`;
    })
    .join('');
  
  if (frequencyItems) {
    return `<ul style="text-align: left;">${frequencyItems}</ul>`;
  } else {
    return '';
  }
}

