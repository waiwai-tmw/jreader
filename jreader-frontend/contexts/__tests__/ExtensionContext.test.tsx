import { render, screen, waitFor, act } from '@testing-library/react';
import React from 'react';

import '@testing-library/jest-dom';
import { ExtensionProvider, useExtension } from '../ExtensionContext';

import { CONTENT_SCRIPT_EVENT_EXTENSION_AVAILABILITY_CHECK_RESPONSE, ExtensionAvailabilityKind } from '@jreader/shared-types-ts/extensionAvailability';

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

// Test component that uses ExtensionContext
const TestComponent = () => {
  const { extensionStatus, isChecking } = useExtension();
  
  return (
    <div>
      <div data-testid="extension-available">
        Available: {extensionStatus.available === null ? 'checking' : extensionStatus.available.toString()}
      </div>
      <div data-testid="extension-paired">
        Paired: {extensionStatus.paired === null ? 'checking' : extensionStatus.paired.toString()}
      </div>
      <div data-testid="is-checking">
        Checking: {isChecking.toString()}
      </div>
    </div>
  );
};

// Helper to simulate extension response using new message format
const simulateExtensionResponse = (kind: typeof ExtensionAvailabilityKind[keyof typeof ExtensionAvailabilityKind]) => {
  const event = new MessageEvent('message', {
    origin: window.location.origin,
    data: {
      type: CONTENT_SCRIPT_EVENT_EXTENSION_AVAILABILITY_CHECK_RESPONSE,
      extensionAvailability: { kind }
    }
  });
  window.dispatchEvent(event);
};

// No explicit pairing update message; use storage events instead

describe('ExtensionContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  it('should initialize with null status', () => {
    render(
      <ExtensionProvider>
        <TestComponent />
      </ExtensionProvider>
    );

    expect(screen.getByTestId('extension-available')).toHaveTextContent('Available: checking');
    expect(screen.getByTestId('extension-paired')).toHaveTextContent('Paired: checking');
    expect(screen.getByTestId('is-checking')).toHaveTextContent('Checking: true');
  });

  it('should check extension on mount', async () => {
    render(
      <ExtensionProvider>
        <TestComponent />
      </ExtensionProvider>
    );

    // Initially checking
    expect(screen.getByTestId('is-checking')).toHaveTextContent('Checking: true');

    // Simulate extension response
    act(() => {
      simulateExtensionResponse(ExtensionAvailabilityKind.AVAILABLE_UNAUTH);
    });

    await waitFor(() => {
      expect(screen.getByTestId('extension-available')).toHaveTextContent('Available: false');
      expect(screen.getByTestId('extension-paired')).toHaveTextContent('Paired: false');
      expect(screen.getByTestId('is-checking')).toHaveTextContent('Checking: false');
    });
  });

  it('should handle extension check response (authenticated)', async () => {
    render(
      <ExtensionProvider>
        <TestComponent />
      </ExtensionProvider>
    );

    // Simulate extension response with AVAILABLE_AUTH
    act(() => {
      simulateExtensionResponse(ExtensionAvailabilityKind.AVAILABLE_AUTH);
    });

    await waitFor(() => {
      expect(screen.getByTestId('extension-available')).toHaveTextContent('Available: true');
      expect(screen.getByTestId('extension-paired')).toHaveTextContent('Paired: true');
    });
  });

  // Pairing updates are handled via storage events; covered by other tests

  it('should handle extension timeout', async () => {
    render(
      <ExtensionProvider>
        <TestComponent />
      </ExtensionProvider>
    );

    // Wait for timeout (2 seconds)
    await waitFor(() => {
      expect(screen.getByTestId('extension-available')).toHaveTextContent('Available: false');
      expect(screen.getByTestId('extension-paired')).toHaveTextContent('Paired: false');
    }, { timeout: 3000 });
  });

  it('should handle unavailable extension', async () => {
    render(
      <ExtensionProvider>
        <TestComponent />
      </ExtensionProvider>
    );

    // Simulate unavailable response
    act(() => {
      simulateExtensionResponse(ExtensionAvailabilityKind.UNAVAILABLE);
    });

    await waitFor(() => {
      expect(screen.getByTestId('extension-available')).toHaveTextContent('Available: false');
      expect(screen.getByTestId('extension-paired')).toHaveTextContent('Paired: false');
    });
  });

  it('should handle extension status changed event', async () => {
    render(
      <ExtensionProvider>
        <TestComponent />
      </ExtensionProvider>
    );

    // First response
    act(() => {
      simulateExtensionResponse(ExtensionAvailabilityKind.AVAILABLE_UNAUTH);
    });

    await waitFor(() => {
      expect(screen.getByTestId('extension-available')).toHaveTextContent('Available: false');
    });

    // Simulate status change event (e.g., user logged in via extension)
    act(() => {
      const event = new MessageEvent('message', {
        origin: window.location.origin,
        data: { type: 'extension.statusChanged' }
      });
      window.dispatchEvent(event);
    });

    // Wait for postMessage to be called again
    await waitFor(() => {
      // postMessage should be called twice now: once on mount, once after status changed
      expect(mockPostMessage.mock.calls.length).toBeGreaterThan(1);
    });
  });

});
