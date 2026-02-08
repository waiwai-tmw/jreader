import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import React from 'react';

import '@testing-library/jest-dom';
import { AnkiHealthProvider } from '../AnkiHealthContext';

import { AutoSyncProvider } from '../AutoSyncContext';
import { ExtensionProvider } from '../ExtensionContext';

import { EXTENSION_CONTENT_SCRIPT_EVENT_EXTENSION_AVAILABILITY_CHECK_RESPONSE, EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_CHECK_HEALTH_RESPONSE } from '@/types/events';

// Mock window.postMessage
const mockPostMessage = jest.fn();
Object.defineProperty(window, 'postMessage', {
  value: mockPostMessage,
  writable: true
});

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

// Mock ExtensionContext to return controllable status
const mockExtensionStatus = { available: true };
jest.mock('../ExtensionContext', () => ({
  ExtensionProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useExtension: () => ({
    extensionStatus: mockExtensionStatus,
    checkExtensionStatus: jest.fn()
  })
}));

// Test component that uses all contexts
const TestComponent = () => {
  const { autoSyncEnabled, setAutoSyncEnabled } = require('../AutoSyncContext').useAutoSync();
  const { healthStatus, checkAnkiHealth } = require('../AnkiHealthContext').useAnkiHealth();
  const { extensionStatus } = require('../ExtensionContext').useExtension();
  
  return (
    <div>
      <div data-testid="auto-sync-status">
        Auto-sync: {autoSyncEnabled ? 'enabled' : 'disabled'}
      </div>
      <div data-testid="health-status">
        AnkiConnect: {healthStatus.available ? 'available' : 'unavailable'}
      </div>
      <div data-testid="extension-status">
        Extension: {extensionStatus.available ? 'available' : 'unavailable'}
      </div>
      <button 
        data-testid="toggle-auto-sync" 
        onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
      >
        Toggle Auto-sync
      </button>
      <button 
        data-testid="check-health" 
        onClick={checkAnkiHealth}
      >
        Check Health
      </button>
    </div>
  );
};

// Helper function to render with all providers
const renderWithProviders = (autoSyncEnabled = false) => {
  return render(
    <ExtensionProvider>
      <AutoSyncProvider initialValue={autoSyncEnabled}>
        <AnkiHealthProvider>
          <TestComponent />
        </AnkiHealthProvider>
      </AutoSyncProvider>
    </ExtensionProvider>
  );
};

// Helper function to simulate extension response
const simulateExtensionResponse = (type: string, data: any) => {
  act(() => {
    const event = new MessageEvent('message', {
      data: { type, ...data },
      origin: window.location.origin
    });
    window.dispatchEvent(event);
  });
};

// Helper function to simulate extension check response
const simulateExtensionCheckResponse = (available: boolean) => {
  simulateExtensionResponse(EXTENSION_CONTENT_SCRIPT_EVENT_EXTENSION_AVAILABILITY_CHECK_RESPONSE, { available });
};

describe('AnkiHealthContext Auto-Sync Behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPostMessage.mockClear();
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
    
    // Default localStorage mock
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'autoSyncEnabled') return 'false';
      if (key === 'wasAutoDisabled') return 'false';
      return null;
    });
  });

  describe('Auto-sync behavior', () => {
    it('should disable auto-sync when AnkiConnect becomes unavailable', async () => {
      // Set up localStorage to indicate auto-sync was enabled before
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'autoSyncEnabled') return 'true';
        return null;
      });
      
      // Set extension status to available
      mockExtensionStatus.available = true;
      
      renderWithProviders(true);
      
      // Click the check health button to trigger the health check
      const checkHealthButton = screen.getByTestId('check-health');
      fireEvent.click(checkHealthButton);
      
      // Simulate AnkiConnect health check response (unavailable)
      simulateExtensionResponse(EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_CHECK_HEALTH_RESPONSE, { 
        available: false, 
        configured: true, 
        error: 'Connection refused' 
      });
      
      // Wait for the health check to complete and auto-sync to be disabled
      await waitFor(() => {
        expect(screen.getByTestId('auto-sync-status')).toHaveTextContent('Auto-sync: disabled');
      }, { timeout: 3000 });
    });

    it('should enable auto-sync when AnkiConnect becomes available', async () => {
      // Mock localStorage to show auto-sync was disabled
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'autoSyncEnabled') return 'false';
        return null;
      });
      
      // Set extension status to available
      mockExtensionStatus.available = true;
      
      renderWithProviders(false);
      
      // Click the check health button to trigger the health check
      const checkHealthButton = screen.getByTestId('check-health');
      fireEvent.click(checkHealthButton);
      
      // Simulate AnkiConnect health check response (available)
      simulateExtensionResponse(EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_CHECK_HEALTH_RESPONSE, { 
        available: true, 
        configured: true
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('auto-sync-status')).toHaveTextContent('Auto-sync: enabled');
      }, { timeout: 3000 });
    });

    it('should not enable auto-sync when AnkiConnect is not configured', async () => {
      // Mock localStorage to show auto-sync was disabled
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'autoSyncEnabled') return 'false';
        return null;
      });
      
      // Set extension status to available
      mockExtensionStatus.available = true;
      
      renderWithProviders(false);
      
      // Click the check health button to trigger the health check
      const checkHealthButton = screen.getByTestId('check-health');
      fireEvent.click(checkHealthButton);
      
      // Simulate AnkiConnect health check response (not configured)
      simulateExtensionResponse(EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_CHECK_HEALTH_RESPONSE, { 
        available: false, 
        configured: false,
        error: 'AnkiConnect URL not configured'
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('auto-sync-status')).toHaveTextContent('Auto-sync: disabled');
      }, { timeout: 3000 });
    });
  });

  describe('Extension Status Integration', () => {
    it('should disable auto-sync when extension is not available', async () => {
      // Set extension status to not available
      mockExtensionStatus.available = false;
      
      renderWithProviders(true);

      // Click the check health button to trigger the health check
      const checkHealthButton = screen.getByTestId('check-health');
      fireEvent.click(checkHealthButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('auto-sync-status')).toHaveTextContent('Auto-sync: disabled');
      }, { timeout: 3000 });
    });

    it('should enable auto-sync when extension is available and AnkiConnect is healthy', async () => {
      // Set extension status to available
      mockExtensionStatus.available = true;

      renderWithProviders(false);

      // Click the check health button to trigger the health check
      const checkHealthButton = screen.getByTestId('check-health');
      fireEvent.click(checkHealthButton);

      // Simulate AnkiConnect being available
      simulateExtensionResponse(EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_CHECK_HEALTH_RESPONSE, {
        available: true,
        configured: true
      });

      // Auto-sync should be enabled based on Anki availability
      await waitFor(() => {
        expect(screen.getByTestId('auto-sync-status')).toHaveTextContent('Auto-sync: enabled');
      }, { timeout: 3000 });
    });

    it('should re-enable auto-sync when AnkiConnect becomes available after being unavailable', async () => {
      // Set up localStorage to indicate auto-sync was enabled
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'autoSyncEnabled') return 'true';
        return null;
      });

      renderWithProviders(true); // Start with auto-sync enabled

      // Extension is available
      mockExtensionStatus.available = true;

      const checkHealthButton = screen.getByTestId('check-health');

      // First health check - Anki unavailable (auto-disables)
      fireEvent.click(checkHealthButton);

      simulateExtensionResponse(EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_CHECK_HEALTH_RESPONSE, {
        available: false,
        configured: true,
        error: 'Connection refused'
      });

      await waitFor(() => {
        expect(screen.getByTestId('auto-sync-status')).toHaveTextContent('Auto-sync: disabled');
      });

      // Second health check - Anki becomes available (re-enables)
      fireEvent.click(checkHealthButton);

      simulateExtensionResponse(EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_CHECK_HEALTH_RESPONSE, {
        available: true,
        configured: true
      });

      await waitFor(() => {
        expect(screen.getByTestId('auto-sync-status')).toHaveTextContent('Auto-sync: enabled');
      });
    });

    it('should trigger health check when extension status changes', async () => {
      renderWithProviders();

      // Set up extension status
      mockExtensionStatus.available = true;

      // Trigger health check
      const checkHealthButton = screen.getByTestId('check-health');
      fireEvent.click(checkHealthButton);

      // Should trigger AnkiConnect health check
      await waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalledWith(
          { type: 'extension.anki.checkHealth' },
          window.location.origin
        );
      });
    });
  });

  describe('localStorage persistence', () => {
    it('should save autoSyncEnabled state to localStorage', async () => {
      // Set extension status to available
      mockExtensionStatus.available = true;
      
      renderWithProviders(true);
      
      // Click the check health button to trigger the health check
      const checkHealthButton = screen.getByTestId('check-health');
      fireEvent.click(checkHealthButton);
      
      // Simulate AnkiConnect health check response (unavailable)
      simulateExtensionResponse(EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_CHECK_HEALTH_RESPONSE, { 
        available: false, 
        configured: true, 
        error: 'Connection refused' 
      });
      
      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('autoSyncEnabled', 'false');
      }, { timeout: 3000 });
    });
  });

  describe('Real-time behavior', () => {
    it('should update auto-sync state in real-time based on AnkiConnect availability', async () => {
      renderWithProviders(true);
      
      // First check - AnkiConnect available
      const checkHealthButton = screen.getByTestId('check-health');
      fireEvent.click(checkHealthButton);
      
      simulateExtensionResponse(EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_CHECK_HEALTH_RESPONSE, { 
        available: true, 
        configured: true 
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('auto-sync-status')).toHaveTextContent('Auto-sync: enabled');
      });
      
      // Second check - AnkiConnect becomes unavailable
      fireEvent.click(checkHealthButton);
      
      simulateExtensionResponse(EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_CHECK_HEALTH_RESPONSE, { 
        available: false, 
        configured: true, 
        error: 'Connection refused' 
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('auto-sync-status')).toHaveTextContent('Auto-sync: disabled');
      });
    });
  });
});
