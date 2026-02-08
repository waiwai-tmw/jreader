// Test setup configuration for authentication error handling tests
import { vi } from 'vitest';

// Mock global objects that might be used in tests
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn()
};

// Mock fetch if needed
global.fetch = vi.fn();

// Mock setTimeout and setInterval for testing async operations
const originalSetTimeout = global.setTimeout;
const originalSetInterval = global.setInterval;

global.setTimeout = ((...args: any[]) => {
  const [callback, delay, ...rest] = args;
  if (typeof callback === 'function') {
    return originalSetTimeout(callback, Math.min(delay ?? 0, 100), ...rest); // Speed up tests
  }
  return originalSetTimeout(callback, Math.min(delay ?? 0, 100), ...rest);
}) as any;

global.setInterval = ((...args: any[]) => {
  const [callback, delay, ...rest] = args;
  if (typeof callback === 'function') {
    return originalSetInterval(callback, Math.min(delay ?? 0, 100), ...rest); // Speed up tests
  }
  return originalSetInterval(callback, Math.min(delay ?? 0, 100), ...rest);
}) as any;

// Mock clearTimeout and clearInterval
global.clearTimeout = vi.fn();
global.clearInterval = vi.fn();

// Mock Date.now for consistent testing
const mockDateNow = vi.fn(() => 1640995200000); // 2022-01-01T00:00:00.000Z
global.Date.now = mockDateNow;

// Mock Date constructor for consistent date creation
const OriginalDate = global.Date;
global.Date = class extends OriginalDate {
  constructor();
  constructor(...args: any[]) {
    if (args.length === 0) {
      super(1640995200000); // 2022-01-01T00:00:00.000Z
    } else if (args.length === 1) {
      super(args[0]);
    } else {
      super(args[0], args[1], args[2] ?? 1, args[3] ?? 0, args[4] ?? 0, args[5] ?? 0, args[6] ?? 0);
    }
  }

  static override now() {
    return mockDateNow();
  }
} as any;

// Mock navigator.userAgent
Object.defineProperty(global.navigator, 'userAgent', {
  value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  writable: true
});

// Mock window.location
Object.defineProperty(global, 'location', {
  value: {
    href: 'chrome-extension://test-extension-id/popup.html',
    origin: 'chrome-extension://test-extension-id',
    protocol: 'chrome-extension:',
    host: 'test-extension-id',
    hostname: 'test-extension-id',
    port: '',
    pathname: '/popup.html',
    search: '',
    hash: ''
  },
  writable: true
});

// Mock process.env for development environment detection
process.env['NODE_ENV'] = 'test';
