import type { SearchUpdateEvent } from '@/types';
import { debug } from '@/utils/debug';
import type { KanjiCycler } from '@/utils/kanjiCycler';
import type { KanjiState } from '@/utils/kanjiState';

export function createTextPaneClickHandler(
  getKanjiMode: () => boolean,
  kanjiCycler: KanjiCycler,
  cycleKanjiState: (kanji: string, directToKnown: boolean) => Promise<KanjiState>
) {
  return async (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const isKanjiMode = getKanjiMode();
    debug(`Click handled in ${isKanjiMode ? 'KANJI' : 'READ'} mode`);

    const charElement = target.closest('span[data-position]');
    if (!charElement) return;

    const text = charElement.getAttribute('data-text') || '';
    const position = parseInt(charElement.getAttribute('data-position') || '-1', 10);
    const kanji = charElement.getAttribute('data-kanji');

    if (isKanjiMode && kanji) {
      // In KANJI mode, cycle kanji state if it's a kanji character
      await cycleKanjiState(kanji, true);
    } else if (position !== -1) {
      // In READ mode, trigger dictionary lookup
      window.dispatchEvent(new CustomEvent('searchupdate', {
        detail: {
          text,
          position,
          shouldOpenDictionary: true,
          fromTextPane: true
        }
      } as SearchUpdateEvent));
    }
  };
} 