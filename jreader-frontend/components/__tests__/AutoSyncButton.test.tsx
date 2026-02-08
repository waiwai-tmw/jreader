import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import '@testing-library/jest-dom';
import { AutoSyncButton } from '../AutoSyncButton';

// Mock the context hooks
const mockSetAutoSyncEnabled = jest.fn();
const mockCheckAnkiHealth = jest.fn();

jest.mock('@/contexts/AutoSyncContext', () => ({
  useAutoSync: () => ({
    autoSyncEnabled: false,
    setAutoSyncEnabled: mockSetAutoSyncEnabled
  })
}));

jest.mock('@/contexts/AnkiHealthContext', () => ({
  useAnkiHealth: () => ({
    healthStatus: {
      available: true,
      configured: true
    },
    checkAnkiHealth: mockCheckAnkiHealth,
    isChecking: false
  })
}));

jest.mock('@/contexts/ExtensionContext', () => ({
  useExtension: () => ({
    extensionStatus: {
      available: true,
      paired: true
    }
  })
}));

// Mock the UI components to avoid dropdown complexity in tests
jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-trigger">{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-content">{children}</div>
}));

jest.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, disabled }: { checked: boolean; onCheckedChange: (value: boolean) => void; disabled: boolean }) => (
    <button 
      data-testid="auto-sync-switch" 
      onClick={() => onCheckedChange(!checked)}
      disabled={disabled}
    >
      {checked ? 'ON' : 'OFF'}
    </button>
  )
}));

describe('AutoSyncButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the settings button', () => {
    render(<AutoSyncButton />);
    
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    // The first button should be the main settings button
    expect(buttons[0]).toBeInTheDocument();
  });

  it('should render dropdown menu structure', () => {
    render(<AutoSyncButton />);
    
    expect(screen.getByTestId('dropdown-menu')).toBeInTheDocument();
    expect(screen.getByTestId('dropdown-trigger')).toBeInTheDocument();
    expect(screen.getByTestId('dropdown-content')).toBeInTheDocument();
  });

  it('should render auto-sync switch', () => {
    render(<AutoSyncButton />);
    
    const switchElement = screen.getByTestId('auto-sync-switch');
    expect(switchElement).toBeInTheDocument();
    expect(switchElement).toHaveTextContent('OFF'); // autoSyncEnabled is false in mock
  });

  it('should call setAutoSyncEnabled when switch is clicked', () => {
    render(<AutoSyncButton />);
    
    const switchElement = screen.getByTestId('auto-sync-switch');
    fireEvent.click(switchElement);
    expect(mockSetAutoSyncEnabled).toHaveBeenCalledWith(true);
  });
});
