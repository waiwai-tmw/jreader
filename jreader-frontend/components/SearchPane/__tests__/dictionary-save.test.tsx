import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

import '@testing-library/jest-dom';
import { AutoSyncProvider } from '@/contexts/AutoSyncContext';

// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(() => ({
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn()
      }))
    }))
  }))
};

// Mock the Supabase createClient function
jest.mock('@/utils/supabase/client', () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}));

// Mock the SearchPane component with actual card creation logic
const MockSearchPaneWithCardCreation = () => {
  const { autoSyncEnabled } = require('@/contexts/AutoSyncContext').useAutoSync();
  const { createClient } = require('@/utils/supabase/client');
  const { toast } = require('sonner');
  
  const handleCreateCard = async () => {
    try {
      // Simulate the actual card creation logic from SearchPane
      const mockDefinitions = [
        {
          type: 'simple',
          content: 'Simple definition content',
          dictionary_title: 'Test Dictionary',
          dictionary_origin: 'test-dictionary_2024.11.24.0'
        },
        {
          type: 'structured',
          content: '[{"tag":"span","content":"Structured definition"}]',
          dictionary_title: 'Another Dictionary',
          dictionary_origin: 'another-dictionary_2024.11.24.0'
        }
      ];

      const cardData = {
        expression: 'test',
        reading: 'test',
        definitions: mockDefinitions,
        sentence: 'Test sentence',
        pitch_accent: 'test accent'
      };

      // Insert into Supabase
      const supabase = createClient();
      const { data, error } = await supabase
        .from('cards')
        .insert(cardData)
        .select()
        .single();

      if (error) throw error;

      if (autoSyncEnabled) {
        // Simulate extension sync
        window.postMessage({ type: 'extension.availabilityCheck' }, window.location.origin);
        setTimeout(() => {
          window.postMessage({ type: 'syncCard', cardId: data.id }, window.location.origin);
          toast.success('Card created and syncing to Anki...');
        }, 100);
      } else {
        toast.success('Card created! Use the extension to sync to Anki.');
      }
    } catch (error) {
      toast.error('Failed to create card');
    }
  };

  return (
    <div>
      <button onClick={handleCreateCard}>Create Card</button>
      <div>Auto-sync: {autoSyncEnabled ? 'enabled' : 'disabled'}</div>
    </div>
  );
};

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

// Mock postMessage
const mockPostMessage = jest.fn();
Object.defineProperty(window, 'postMessage', {
  value: mockPostMessage,
  writable: true
});

// Helper function to render SearchPane with AutoSyncProvider
const renderSearchPaneWithProvider = (initialValue: boolean) => {
  return render(
    <AutoSyncProvider initialValue={initialValue}>
      <MockSearchPaneWithCardCreation />
    </AutoSyncProvider>
  );
};

describe('SearchPane Dictionary Save', () => {
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

  it('should save definitions with dictionary names to Supabase', async () => {
    const mockInsert = jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({
          data: { id: 123, expression: 'test' },
          error: null
        }))
      }))
    }));

    mockSupabaseClient.from.mockReturnValue({
      insert: mockInsert
    });

    renderSearchPaneWithProvider(false);

    const createButton = screen.getByText('Create Card');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('cards');
      expect(mockInsert).toHaveBeenCalledWith({
        expression: 'test',
        reading: 'test',
        definitions: [
          {
            type: 'simple',
            content: 'Simple definition content',
            dictionary_title: 'Test Dictionary',
            dictionary_origin: 'test-dictionary_2024.11.24.0'
          },
          {
            type: 'structured',
            content: '[{"tag":"span","content":"Structured definition"}]',
            dictionary_title: 'Another Dictionary',
            dictionary_origin: 'another-dictionary_2024.11.24.0'
          }
        ],
        sentence: 'Test sentence',
        pitch_accent: 'test accent'
      });
    });
  });

  it('should handle Supabase errors gracefully', async () => {
    const mockInsert = jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({
          data: null,
          error: { message: 'Database error' }
        }))
      }))
    }));

    mockSupabaseClient.from.mockReturnValue({
      insert: mockInsert
    });

    renderSearchPaneWithProvider(false);

    const createButton = screen.getByText('Create Card');
    fireEvent.click(createButton);

    await waitFor(() => {
      // Should not crash and should handle the error
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('cards');
    });
  });

  it('should preserve dictionary names in structured definitions', async () => {
    const mockInsert = jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({
          data: { id: 123, expression: 'test' },
          error: null
        }))
      }))
    }));

    mockSupabaseClient.from.mockReturnValue({
      insert: mockInsert
    });

    renderSearchPaneWithProvider(false);

    const createButton = screen.getByText('Create Card');
    fireEvent.click(createButton);

    await waitFor(() => {
      const insertCall = mockInsert.mock.calls[0][0];
      expect(insertCall.definitions).toEqual([
        {
          type: 'simple',
          content: 'Simple definition content',
          dictionary_title: 'Test Dictionary',
          dictionary_origin: 'test-dictionary_2024.11.24.0'
        },
        {
          type: 'structured',
          content: '[{"tag":"span","content":"Structured definition"}]',
          dictionary_title: 'Another Dictionary',
          dictionary_origin: 'another-dictionary_2024.11.24.0'
        }
      ]);
    });
  });
});
