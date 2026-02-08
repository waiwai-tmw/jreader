/**
 * Safe window utilities for Next.js applications
 * Handles window APIs with SSR safety
 */

export const safeWindow = {
  /**
   * Check if we're in a browser environment
   */
  get isClient(): boolean {
    return typeof window !== 'undefined';
  },

  /**
   * Safe access to window.location
   */
  get location() {
    if (typeof window !== 'undefined') {
      return window.location;
    }
    return null;
  },

  /**
   * Safe access to window.history
   */
  get history() {
    if (typeof window !== 'undefined') {
      return window.history;
    }
    return null;
  },

  /**
   * Safe access to document
   */
  get document() {
    if (typeof window !== 'undefined') {
      return document;
    }
    return null;
  },

  /**
   * Safe access to window.navigator
   */
  get navigator() {
    if (typeof window !== 'undefined') {
      return window.navigator;
    }
    return null;
  },

  /**
   * Safe access to window.screen
   */
  get screen() {
    if (typeof window !== 'undefined') {
      return window.screen;
    }
    return null;
  }
};

/**
 * Safe location utilities
 */
export const safeLocation = {
  /**
   * Get the current pathname
   */
  get pathname(): string {
    if (typeof window !== 'undefined') {
      return window.location.pathname;
    }
    return '';
  },

  /**
   * Get the current search string
   */
  get search(): string {
    if (typeof window !== 'undefined') {
      return window.location.search;
    }
    return '';
  },

  /**
   * Get the current href
   */
  get href(): string {
    if (typeof window !== 'undefined') {
      return window.location.href;
    }
    return '';
  },

  /**
   * Navigate to a new URL
   */
  navigate: (url: string): void => {
    if (typeof window !== 'undefined') {
      window.location.href = url;
    }
  },

  /**
   * Reload the current page
   */
  reload: (): void => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }
};

/**
 * Safe history utilities
 */
export const safeHistory = {
  /**
   * Push a new state to history
   */
  pushState: (state: any, title: string, url?: string): void => {
    if (typeof window !== 'undefined') {
      window.history.pushState(state, title, url);
    }
  },

  /**
   * Replace the current state in history
   */
  replaceState: (state: any, title: string, url?: string): void => {
    if (typeof window !== 'undefined') {
      window.history.replaceState(state, title, url);
    }
  },

  /**
   * Go back in history
   */
  back: (): void => {
    if (typeof window !== 'undefined') {
      window.history.back();
    }
  },

  /**
   * Go forward in history
   */
  forward: (): void => {
    if (typeof window !== 'undefined') {
      window.history.forward();
    }
  }
};

/**
 * Safe document utilities
 */
export const safeDocument = {
  /**
   * Set the document title
   */
  setTitle: (title: string): void => {
    if (typeof window !== 'undefined') {
      document.title = title;
    }
  },

  /**
   * Get the document title
   */
  getTitle: (): string => {
    if (typeof window !== 'undefined') {
      return document.title;
    }
    return '';
  },

  /**
   * Add an event listener
   */
  addEventListener: (type: string, listener: EventListener): void => {
    if (typeof window !== 'undefined') {
      document.addEventListener(type, listener);
    }
  },

  /**
   * Remove an event listener
   */
  removeEventListener: (type: string, listener: EventListener): void => {
    if (typeof window !== 'undefined') {
      document.removeEventListener(type, listener);
    }
  }
};

/**
 * Safe navigator utilities
 */
export const safeNavigator = {
  /**
   * Get user agent
   */
  getUserAgent: (): string => {
    if (typeof window !== 'undefined') {
      return window.navigator.userAgent;
    }
    return '';
  },

  /**
   * Check if it's a mobile device
   */
  isMobile: (): boolean => {
    if (typeof window !== 'undefined') {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        window.navigator.userAgent
      );
    }
    return false;
  },

  /**
   * Check if it's an iOS device
   */
  isIOS: (): boolean => {
    if (typeof window !== 'undefined') {
      return /iPad|iPhone|iPod/.test(window.navigator.userAgent);
    }
    return false;
  },

  /**
   * Check if it's an Android device
   */
  isAndroid: (): boolean => {
    if (typeof window !== 'undefined') {
      return /Android/.test(window.navigator.userAgent);
    }
    return false;
  }
};

/**
 * Safe screen utilities
 */
export const safeScreen = {
  /**
   * Get screen width
   */
  getWidth: (): number => {
    if (typeof window !== 'undefined') {
      return window.screen.width;
    }
    return 0;
  },

  /**
   * Get screen height
   */
  getHeight: (): number => {
    if (typeof window !== 'undefined') {
      return window.screen.height;
    }
    return 0;
  },

  /**
   * Get viewport width
   */
  getViewportWidth: (): number => {
    if (typeof window !== 'undefined') {
      return window.innerWidth;
    }
    return 0;
  },

  /**
   * Get viewport height
   */
  getViewportHeight: (): number => {
    if (typeof window !== 'undefined') {
      return window.innerHeight;
    }
    return 0;
  }
};
