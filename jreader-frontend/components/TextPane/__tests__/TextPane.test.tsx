import { render, screen } from '@testing-library/react';
import React from 'react';

import TextPane from '../TextPane';

import { isIOS } from '@/utils/deviceDetection';

// Mock the device detection utilities
jest.mock('@/utils/deviceDetection');

// Mock other dependencies
jest.mock('@/hooks/useBookmarkManager', () => ({
  useBookmarkManager: () => ({
    getBookmark: jest.fn(),
    restoreBookmark: jest.fn(),
    saveBookmark: jest.fn(),
    isAtBookmark: false,
    startNavigation: jest.fn(),
    endNavigation: jest.fn(),
    manager: {
      getState: () => ({ isRestoringBookmark: false }),
      checkIfAtBookmarkDebounced: jest.fn(),
      startScroll: jest.fn(),
      endScroll: jest.fn()
    }
  })
}));

jest.mock('@/hooks/useKanjiStates', () => ({
  useKanjiStates: () => ({
    knownKanji: [],
    encounteredKanji: [],
    isLoading: false,
    cycleKanjiState: jest.fn(),
    error: null
  }),
  KanjiQueryEnabled: {
    ENABLED: 'ENABLED'
  },
  SubscriptionCheck: {
    DONT_CHECK: 'DONT_CHECK'
  }
}));

jest.mock('@/contexts/KanjiModeContext', () => ({
  useKanjiMode: () => ({
    isKanjiMode: false
  })
}));

jest.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({
    fontSize: 16,
    verticalMargin: 10
  })
}));

jest.mock('@/contexts/EinkModeContext', () => ({
  useEinkMode: () => ({
    isEinkMode: false
  })
}));

jest.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'light',
    resolvedTheme: 'light'
  })
}));

describe('TextPane scrolling behavior', () => {
  const mockProps = {
    onSearch: jest.fn(),
    onBookUpdate: jest.fn(),
    onBookmarkChange: jest.fn(),
    currentBook: null,
    onScroll: jest.fn(),
    userPreferences: null
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock iframe element
    const mockIframe = {
      contentDocument: {
        body: document.createElement('body'),
        documentElement: document.createElement('html'),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        querySelector: jest.fn(),
        querySelectorAll: jest.fn(() => []),
        createElement: jest.fn(),
        createTreeWalker: jest.fn(),
        head: {
          appendChild: jest.fn()
        }
      },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      clientWidth: 800
    };

    // Mock iframe ref
    jest.spyOn(React, 'useRef').mockReturnValue({
      current: mockIframe
    } as any);
  });

  it('should allow scrolling on Android devices', () => {
    (isIOS as jest.Mock).mockReturnValue(false);

    render(<TextPane {...mockProps} />);
    
    const iframe = screen.getByTitle('Reader content');
    expect(iframe).toHaveAttribute('scrolling', 'auto');
  });

  it('should prevent scrolling on iOS devices', () => {
    (isIOS as jest.Mock).mockReturnValue(true);

    render(<TextPane {...mockProps} />);
    
    const iframe = screen.getByTitle('Reader content');
    expect(iframe).toHaveAttribute('scrolling', 'no');
  });

  it('should prevent scrolling on iPadOS devices', () => {
    (isIOS as jest.Mock).mockReturnValue(true);

    render(<TextPane {...mockProps} />);
    
    const iframe = screen.getByTitle('Reader content');
    expect(iframe).toHaveAttribute('scrolling', 'no');
  });

  it('should allow scrolling on other mobile devices (not iOS)', () => {
    (isIOS as jest.Mock).mockReturnValue(false);

    render(<TextPane {...mockProps} />);
    
    const iframe = screen.getByTitle('Reader content');
    expect(iframe).toHaveAttribute('scrolling', 'auto');
  });

  it('should allow scrolling on desktop devices', () => {
    (isIOS as jest.Mock).mockReturnValue(false);

    render(<TextPane {...mockProps} />);
    
    const iframe = screen.getByTitle('Reader content');
    expect(iframe).toHaveAttribute('scrolling', 'auto');
  });
});
