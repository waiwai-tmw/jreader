import { KanjiState, kanjiStateToClass } from '@/utils/kanjiState';

export class KanjiCycler {
  private shouldHighlight: boolean = true;

  constructor(private iframeRef: React.RefObject<HTMLIFrameElement>) {}

  setShouldHighlight(shouldHighlight: boolean) {
    this.shouldHighlight = shouldHighlight;
  }

  updateKanjiDisplay(kanji: string, newState: KanjiState) {
    const stateClass = kanjiStateToClass(newState);
    
    const doc = this.iframeRef.current?.contentDocument;
    if (doc) {
      const elements = doc.querySelectorAll(`[data-kanji="${kanji}"]`);
      elements.forEach(element => {
        element.classList.remove('kanji-known', 'kanji-encountered', 'kanji-not-mined');
        // Only add highlighting classes if highlighting is enabled
        if (this.shouldHighlight) {
          element.classList.add(`kanji-${stateClass}`);
        }
        // Note: The data-kanji attribute and click functionality remain regardless of highlighting setting
      });
    }
  }

  isKanjiHighlight(element: Element): boolean {
    const isHighlight = element.classList.contains('kanji-highlight');
    console.log(`Checking if kanji highlight: ${isHighlight}`, element);
    return isHighlight;
  }

  // Get the kanji styles that need to be injected into the iframe
  getKanjiStyles(): string {
    const notMined = kanjiStateToClass(KanjiState.NOT_MINED);
    const encountered = kanjiStateToClass(KanjiState.ENCOUNTERED);
    const known = kanjiStateToClass(KanjiState.KNOWN);

    // Combined styles that work for both modes using CSS variables
    return `
      [data-kanji] {
        cursor: pointer !important;
        position: relative !important;
        z-index: 1 !important;
      }
      .kanji-${encountered} { 
        background-color: hsl(var(--kanji-encountered)) !important;
        border-left: var(--kanji-encountered-border, none) !important;
        margin-left: var(--kanji-encountered-margin, 0) !important;
        padding-left: var(--kanji-encountered-padding, 0) !important;
      }
      .kanji-${encountered}::before {
        content: '' !important;
        position: absolute !important;
        left: -4px !important;
        top: 0 !important;
        bottom: 0 !important;
        width: var(--kanji-encountered-width, 0px) !important;
        background-color: var(--kanji-encountered-underline-color, transparent) !important;
        pointer-events: none !important;
        z-index: -1 !important;
      }
      .kanji-${notMined} { 
        background-color: hsl(var(--kanji-not-mined)) !important;
        border-left: var(--kanji-notmined-border, none) !important;
        margin-left: var(--kanji-notmined-margin, 0) !important;
        padding-left: var(--kanji-notmined-padding, 0) !important;
      }
      .kanji-${notMined}::before {
        content: '' !important;
        position: absolute !important;
        left: -4px !important;
        top: 0 !important;
        bottom: 0 !important;
        width: var(--kanji-notmined-width, 0px) !important;
        background-color: var(--kanji-notmined-underline-color, transparent) !important;
        pointer-events: none !important;
        z-index: -1 !important;
      }
      .kanji-${known} { 
        background-color: transparent !important;
        border-left: none !important;
        margin-left: 0 !important;
        padding-left: 0 !important;
      }
    `;
  }

  // Update CSS variables for e-ink mode
  updateEinkMode(isEinkMode: boolean) {
    const doc = this.iframeRef.current?.contentDocument;
    if (doc?.documentElement) {
      if (isEinkMode) {
        // E-ink mode: use underlines instead of background colors
        doc.documentElement.style.setProperty('--kanji-encountered-border', 'none');
        doc.documentElement.style.setProperty('--kanji-encountered-margin', '0');
        doc.documentElement.style.setProperty('--kanji-encountered-padding', '0');
        doc.documentElement.style.setProperty('--kanji-encountered-width', '3px');
        doc.documentElement.style.setProperty('--kanji-encountered-underline-color', '#666666');
        doc.documentElement.style.setProperty('--kanji-notmined-border', 'none');
        doc.documentElement.style.setProperty('--kanji-notmined-margin', '0');
        doc.documentElement.style.setProperty('--kanji-notmined-padding', '0');
        doc.documentElement.style.setProperty('--kanji-notmined-width', '3px');
        doc.documentElement.style.setProperty('--kanji-notmined-underline-color', '#333333');
        doc.documentElement.style.setProperty('--kanji-known-border', 'none');
        doc.documentElement.style.setProperty('--kanji-known-margin', '0');
        doc.documentElement.style.setProperty('--kanji-known-padding', '0');
        doc.documentElement.style.setProperty('--kanji-known-width', '0px');
        doc.documentElement.style.setProperty('--kanji-known-underline-color', 'transparent');
      } else {
        // Normal mode variables - don't override theme colors, just set layout properties
        doc.documentElement.style.setProperty('--kanji-encountered-border', 'none');
        doc.documentElement.style.setProperty('--kanji-encountered-margin', '0');
        doc.documentElement.style.setProperty('--kanji-encountered-padding', '0');
        doc.documentElement.style.setProperty('--kanji-encountered-width', '0px');
        doc.documentElement.style.setProperty('--kanji-encountered-underline-color', 'transparent');
        doc.documentElement.style.setProperty('--kanji-notmined-border', 'none');
        doc.documentElement.style.setProperty('--kanji-notmined-margin', '0');
        doc.documentElement.style.setProperty('--kanji-notmined-padding', '0');
        doc.documentElement.style.setProperty('--kanji-notmined-width', '0px');
        doc.documentElement.style.setProperty('--kanji-notmined-underline-color', 'transparent');
        doc.documentElement.style.setProperty('--kanji-known-width', '0px');
        doc.documentElement.style.setProperty('--kanji-known-underline-color', 'transparent');
        // Note: Theme colors are set by updateThemeColors, not here
      }
    }
  }

  // Update CSS variables for theme changes
  updateThemeColors(theme: string, isEinkMode: boolean = false) {
    const doc = this.iframeRef.current?.contentDocument;
    if (doc?.documentElement) {
      if (isEinkMode) {
        // E-ink mode: set background colors to transparent so only underlines show
        doc.documentElement.style.setProperty('--kanji-encountered', '0 0% 0 / 0');
        doc.documentElement.style.setProperty('--kanji-not-mined', '0 0% 0 / 0');
        doc.documentElement.style.setProperty('--kanji-known', '0 0% 0 / 0');
      } else {
        // Normal mode: use theme colors
        if (theme === 'asuka') {
          // Asuka theme colors - purple and green highlighting
          doc.documentElement.style.setProperty('--kanji-encountered', '280 100% 25%');
          doc.documentElement.style.setProperty('--kanji-not-mined', '120 100% 20%');
          doc.documentElement.style.setProperty('--kanji-known', '0 0% 100%');
        } else if (theme === 'solarized-light') {
          // Solarized Light colors
          doc.documentElement.style.setProperty('--kanji-encountered', '60 100% 85%');
          doc.documentElement.style.setProperty('--kanji-not-mined', '210 100% 89%');
          doc.documentElement.style.setProperty('--kanji-known', '0 0% 0');
        } else if (theme === 'solarized-dark') {
          // Solarized Dark colors
          doc.documentElement.style.setProperty('--kanji-encountered', '60 100% 25%');
          doc.documentElement.style.setProperty('--kanji-not-mined', '210 100% 30%');
          doc.documentElement.style.setProperty('--kanji-known', '0 0% 100%');
        } else if (theme === 'dark') {
          // Dark mode colors - darker for better contrast on dark backgrounds
          doc.documentElement.style.setProperty('--kanji-encountered', '60 100% 15%');
          doc.documentElement.style.setProperty('--kanji-not-mined', '210 100% 30%');
          doc.documentElement.style.setProperty('--kanji-known', '0 0% 100%');
        } else {
          // Light mode colors
          doc.documentElement.style.setProperty('--kanji-encountered', '60 100% 85%');
          doc.documentElement.style.setProperty('--kanji-not-mined', '210 100% 89%');
          doc.documentElement.style.setProperty('--kanji-known', '0 0% 0');
        }
      }
    }
  }
} 