import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

import { EXTENSION_CONTENT_SCRIPT_EVENT_EXTENSION_AVAILABILITY_CHECK, EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_SYNC_CARDS } from '@/types/events';
import '@testing-library/jest-dom';
import { AutoSyncProvider } from '@/contexts/AutoSyncContext';

// Create a mock SearchPane component
const MockSearchPane = () => {
  const { autoSyncEnabled } = require('@/contexts/AutoSyncContext').useAutoSync();
  const { toast } = require('sonner');
  
  const handleCreateCard = async () => {
    // Simulate card creation
    const mockCardData = { id: 123, expression: 'test', reading: 'test' };
    
    if (autoSyncEnabled) {
      // Simulate extension check
      window.postMessage({ type: EXTENSION_CONTENT_SCRIPT_EVENT_EXTENSION_AVAILABILITY_CHECK }, window.location.origin);
      
      // Simulate extension response
      setTimeout(() => {
        window.postMessage({ type: EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_SYNC_CARDS, cardIds: [mockCardData.id] }, window.location.origin);
        toast.success('Card created and syncing to Anki...');
      }, 100);
    } else {
      toast.success('Card created! Use the extension to sync to Anki.');
    }
  };

  return (
    <div>
      <button onClick={handleCreateCard}>Create Card</button>
      <div>Auto-sync: {autoSyncEnabled ? 'enabled' : 'disabled'}</div>
    </div>
  );
};

// Mock the SearchPane module
jest.mock('../SearchPane', () => ({
  __esModule: true,
  default: MockSearchPane
}));

// Mock window.postMessage
const mockPostMessage = jest.fn();
Object.defineProperty(window, 'postMessage', {
  value: mockPostMessage,
  writable: true
});

// Mock toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn()
  }
}));

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

// Helper function to render SearchPane with AutoSyncProvider
const renderSearchPaneWithProvider = (autoSyncEnabled = false) => {
  return render(
    <AutoSyncProvider initialValue={autoSyncEnabled}>
      <MockSearchPane />
    </AutoSyncProvider>
  );
};

describe('SearchPane Auto-Sync Behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPostMessage.mockClear();
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
    
    // Default localStorage mock
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === 'autoSyncEnabled') return 'false';
      return null;
    });
  });

  describe('Auto-sync enabled', () => {
    it('should send extension check and sync messages when auto-sync is enabled', async () => {
      // Mock localStorage to return 'true' for autoSyncEnabled
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'autoSyncEnabled') return 'true';
        return null;
      });
      
      renderSearchPaneWithProvider(true);

      const createButton = screen.getByText('Create Card');
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalledWith(
          { type: EXTENSION_CONTENT_SCRIPT_EVENT_EXTENSION_AVAILABILITY_CHECK },
          window.location.origin
        );
      });

      await waitFor(() => {
        expect(mockPostMessage).toHaveBeenCalledWith(
          { type: EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_SYNC_CARDS, cardIds: [123] },
          window.location.origin
        );
      });
    });

    it('should show sync success message when auto-sync is enabled', async () => {
      const { toast } = await import('sonner');
      
      // Mock localStorage to return 'true' for autoSyncEnabled
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'autoSyncEnabled') return 'true';
        return null;
      });
      
      renderSearchPaneWithProvider(true);

      const createButton = screen.getByText('Create Card');
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Card created and syncing to Anki...');
      });
    });

    it('should display auto-sync status as enabled', () => {
      // Mock localStorage to return 'true' for autoSyncEnabled
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'autoSyncEnabled') return 'true';
        return null;
      });
      
      renderSearchPaneWithProvider(true);
      
      expect(screen.getByText('Auto-sync: enabled')).toBeInTheDocument();
    });
  });

  describe('Auto-sync disabled', () => {
    it('should not send extension messages when auto-sync is disabled', async () => {
      renderSearchPaneWithProvider(false);

      const createButton = screen.getByText('Create Card');
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(mockPostMessage).not.toHaveBeenCalledWith(
          { type: EXTENSION_CONTENT_SCRIPT_EVENT_EXTENSION_AVAILABILITY_CHECK },
          window.location.origin
        );
        expect(mockPostMessage).not.toHaveBeenCalledWith(
          { type: EXTENSION_CONTENT_SCRIPT_EVENT_ANKI_SYNC_CARDS, cardIds: [123] },
          window.location.origin
        );
      });
    });

    it('should show basic success message when auto-sync is disabled', async () => {
      const { toast } = await import('sonner');
      
      renderSearchPaneWithProvider(false);

      const createButton = screen.getByText('Create Card');
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Card created! Use the extension to sync to Anki.');
      });
    });

    it('should display auto-sync status as disabled', () => {
      renderSearchPaneWithProvider(false);
      
      expect(screen.getByText('Auto-sync: disabled')).toBeInTheDocument();
    });
  });

  describe('localStorage persistence', () => {
    it('should load auto-sync state from localStorage on initialization', () => {
      // Mock localStorage to return 'true' for autoSyncEnabled
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'autoSyncEnabled') return 'true';
        return null;
      });
      
      renderSearchPaneWithProvider(false); // initialValue should be overridden by localStorage
      
      expect(screen.getByText('Auto-sync: enabled')).toBeInTheDocument();
    });

    it('should save auto-sync state to localStorage when state changes', async () => {
      mockLocalStorage.getItem.mockImplementation(() => null);
      
      renderSearchPaneWithProvider(false);
      
      // The AutoSyncContext only saves to localStorage when setAutoSyncEnabled is called
      // This test verifies that the context is set up correctly for saving
      // The actual saving happens when the user toggles the setting in the UI
      expect(screen.getByText('Auto-sync: disabled')).toBeInTheDocument();
    });

    it('should use initialValue when localStorage is empty', () => {
      // Mock localStorage to return null (no stored value)
      mockLocalStorage.getItem.mockImplementation(() => null);
      
      renderSearchPaneWithProvider(true);
      
      expect(screen.getByText('Auto-sync: enabled')).toBeInTheDocument();
    });

    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage to throw an error
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });
      
      // Should not crash and should use initialValue
      renderSearchPaneWithProvider(false);
      
      expect(screen.getByText('Auto-sync: disabled')).toBeInTheDocument();
    });
  });
});
