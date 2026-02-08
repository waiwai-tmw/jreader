import type { DictionaryResult, TermEntry } from '@/types/backend-types';

export const groupByTerm = (
  dictionaryResults: DictionaryResult[],
  dictionaryOrder: string[]
) => {
//   console.log('📚 Dictionary order from preferences:', dictionaryOrder);

  const termMap = new Map<string, {
    term: string,
    reading: string | undefined,
    dictEntries: Array<{
      title: string,
      revision: string,
      origin: string,
      entries: TermEntry[]
    }>,
    totalScore: number
  }>();

  // First pass: collect all entries by term
  dictionaryResults.forEach(dictResult => {
    dictResult.entries.forEach((entry: TermEntry) => {
      const key = `${entry.text}|${entry.reading || ''}`;
      
      if (!termMap.has(key)) {
        termMap.set(key, {
          term: entry.text,
          reading: entry.reading,
          dictEntries: [],
          totalScore: 0
        });
      }
      
      const termGroup = termMap.get(key)!;
      const dictKey = `${dictResult.title}#${dictResult.revision}`;
      
      // Find existing dictionary entry or create new one
      let dictEntry = termGroup.dictEntries.find(d => 
        `${d.title}#${d.revision}` === dictKey
      );
      
      if (!dictEntry) {
        dictEntry = {
          title: dictResult.title,
          revision: dictResult.revision,
          origin: dictResult.origin,
          entries: []
        };
        termGroup.dictEntries.push(dictEntry);
      }
      
      dictEntry.entries.push(entry);
      termGroup.totalScore = Math.max(termGroup.totalScore, entry.score);
    });
  });

  const sorted = Array.from(termMap.values())
    .sort((a, b) => {
      // Sort by term length first (descending)
      const lengthDiff = b.term.length - a.term.length;
      if (lengthDiff !== 0) return lengthDiff;
      
      // If terms are the same length, sort by score
      return b.totalScore - a.totalScore;
    });

  // Sort dictEntries within each term group based on dictionary order
  sorted.forEach(termGroup => {
    termGroup.dictEntries.sort((a, b) => {
      const aIndex = dictionaryOrder.indexOf(`${a.title}#${a.revision}`);
      const bIndex = dictionaryOrder.indexOf(`${b.title}#${b.revision}`);
      
      // If dictionary is not in order list, put it at the end
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      
      return aIndex - bIndex;
    });
  });

  return sorted;
}; 