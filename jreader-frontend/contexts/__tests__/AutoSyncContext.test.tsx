import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import '@testing-library/jest-dom';
import { AutoSyncProvider } from '../AutoSyncContext';

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

// Test component that uses AutoSyncContext
const TestComponent = () => {
  const { autoSyncEnabled, setAutoSyncEnabled } = require('../AutoSyncContext').useAutoSync();
  
  return (
    <div>
      <div data-testid="auto-sync-status">
        Auto-sync: {autoSyncEnabled ? 'enabled' : 'disabled'}
      </div>
      <button 
        data-testid="toggle-auto-sync" 
        onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
      >
        Toggle Auto-sync
      </button>
    </div>
  );
};

// Helper function to render with AutoSyncProvider
const renderWithProvider = (initialValue = false) => {
  return render(
    <AutoSyncProvider initialValue={initialValue}>
      <TestComponent />
    </AutoSyncProvider>
  );
};

describe('AutoSyncContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
  });

  describe('localStorage persistence', () => {
    it('should load auto-sync state from localStorage on initialization', () => {
      // Mock localStorage to return 'true' for autoSyncEnabled
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'autoSyncEnabled') return 'true';
        return null;
      });
      
      renderWithProvider(false); // initialValue should be overridden by localStorage
      
      expect(screen.getByTestId('auto-sync-status')).toHaveTextContent('Auto-sync: enabled');
    });

    it('should use initialValue when localStorage is empty', () => {
      // Mock localStorage to return null (no stored value)
      mockLocalStorage.getItem.mockImplementation(() => null);
      
      renderWithProvider(true);
      
      expect(screen.getByTestId('auto-sync-status')).toHaveTextContent('Auto-sync: enabled');
    });

    it('should save auto-sync state to localStorage when toggled', () => {
      mockLocalStorage.getItem.mockImplementation(() => null);
      
      renderWithProvider(false);
      
      const toggleButton = screen.getByTestId('toggle-auto-sync');
      fireEvent.click(toggleButton);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('autoSyncEnabled', 'true');
    });

    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage to throw an error
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });
      
      // Should not crash and should use initialValue
      renderWithProvider(false);
      
      expect(screen.getByTestId('auto-sync-status')).toHaveTextContent('Auto-sync: disabled');
    });
  });

  describe('state management', () => {
    it('should toggle auto-sync state when button is clicked', () => {
      mockLocalStorage.getItem.mockImplementation(() => null);
      
      renderWithProvider(false);
      
      expect(screen.getByTestId('auto-sync-status')).toHaveTextContent('Auto-sync: disabled');
      
      const toggleButton = screen.getByTestId('toggle-auto-sync');
      fireEvent.click(toggleButton);
      
      expect(screen.getByTestId('auto-sync-status')).toHaveTextContent('Auto-sync: enabled');
    });

    it('should maintain state across multiple toggles', () => {
      mockLocalStorage.getItem.mockImplementation(() => null);
      
      renderWithProvider(false);
      
      const toggleButton = screen.getByTestId('toggle-auto-sync');
      
      // Toggle on
      fireEvent.click(toggleButton);
      expect(screen.getByTestId('auto-sync-status')).toHaveTextContent('Auto-sync: enabled');
      
      // Toggle off
      fireEvent.click(toggleButton);
      expect(screen.getByTestId('auto-sync-status')).toHaveTextContent('Auto-sync: disabled');
      
      // Toggle on again
      fireEvent.click(toggleButton);
      expect(screen.getByTestId('auto-sync-status')).toHaveTextContent('Auto-sync: enabled');
    });
  });
});
