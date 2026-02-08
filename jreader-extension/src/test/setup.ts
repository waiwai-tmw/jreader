import '@testing-library/jest-dom';

// Mock browser APIs for testing
const mockBrowser = {
  runtime: {
    id: 'test-extension-id',
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    onInstalled: {
      addListener: vi.fn(),
    },
    onStartup: {
      addListener: vi.fn(),
    },
    openOptionsPage: vi.fn(),
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  tabs: {
    create: vi.fn(),
  },
  permissions: {
    request: vi.fn(),
  },
};

// Mock webextension-polyfill
vi.mock('webextension-polyfill', () => ({
  default: mockBrowser,
}));

// Mock global browser object
Object.defineProperty(global, 'browser', {
  value: mockBrowser,
  writable: true,
});

Object.defineProperty(global, 'chrome', {
  value: mockBrowser,
  writable: true,
});

// Mock window.postMessage
Object.defineProperty(window, 'postMessage', {
  value: vi.fn(),
  writable: true,
});

// Mock navigator.userAgent
Object.defineProperty(navigator, 'userAgent', {
  value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  writable: true,
});

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
