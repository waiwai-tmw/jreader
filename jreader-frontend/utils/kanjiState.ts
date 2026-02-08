export enum KanjiState {
  NOT_MINED = -1,
  ENCOUNTERED = 0,
  KNOWN = 1
}

export function kanjiStateToClass(state: KanjiState): string {
  switch (state) {
    case KanjiState.NOT_MINED:
      return 'not-mined';
    case KanjiState.ENCOUNTERED:
      return 'encountered';
    case KanjiState.KNOWN:
      return 'known';
    default:
      console.error('Invalid kanji state:', state);
      return 'not-mined';
  }
}

export function isKanjiNotMined(char: string, knownKanji: string[], encounteredKanji: string[]): boolean {
  return !knownKanji.includes(char) && !encounteredKanji.includes(char);
} 