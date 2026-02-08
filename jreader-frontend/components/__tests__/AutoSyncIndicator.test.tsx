import { render, screen } from '@testing-library/react';
import React from 'react';

import '@testing-library/jest-dom';
import { AutoSyncIndicator } from '../AutoSyncIndicator';

// Mock the dropdown menu to always show content
jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-trigger">{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-content">{children}</div>,
}));

// Mock state for contexts
let mockExtensionStatus = { available: true, paired: true };
let mockAutoSyncEnabled = false;
let mockHealthStatus = { available: false, configured: false, error: null, lastChecked: null, checking: false };
let mockIsChecking = false;

// Mock functions for contexts
const mockUseExtension = jest.fn();
const mockUseAutoSync = jest.fn();
const mockUseAnkiHealth = jest.fn();
const mockSetAutoSyncEnabled = jest.fn();
const mockCheckAnkiHealth = jest.fn();

// Mock the extension context
jest.mock('@/contexts/ExtensionContext', () => ({
  useExtension: () => mockUseExtension()
}));

// Mock the auto sync context
jest.mock('@/contexts/AutoSyncContext', () => ({
  useAutoSync: () => mockUseAutoSync()
}));

// Mock the anki health context
jest.mock('@/contexts/AnkiHealthContext', () => ({
  useAnkiHealth: () => mockUseAnkiHealth()
}));

describe('AutoSyncIndicator', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock state
    mockExtensionStatus = { available: true, paired: true };
    mockAutoSyncEnabled = false;
    mockHealthStatus = { available: false, configured: false, error: null, lastChecked: null, checking: false };
    mockIsChecking = false;

    // Set up mock return values
    mockUseExtension.mockReturnValue({
      extensionStatus: mockExtensionStatus,
      checkExtensionStatus: jest.fn()
    });

    mockUseAutoSync.mockReturnValue({
      autoSyncEnabled: mockAutoSyncEnabled,
      setAutoSyncEnabled: mockSetAutoSyncEnabled
    });

    mockUseAnkiHealth.mockReturnValue({
      healthStatus: mockHealthStatus,
      checkAnkiHealth: mockCheckAnkiHealth,
      isChecking: mockIsChecking
    });
  });

  it('should render auto-sync toggle', () => {
    render(<AutoSyncIndicator />);

    const autoSyncToggle = screen.getByText('Auto-sync to Anki');
    expect(autoSyncToggle).toBeInTheDocument();
  });

  it('should hide AnkiConnect status when extension is not available', () => {
    mockExtensionStatus = { available: false, paired: false };
    mockUseExtension.mockReturnValue({
      extensionStatus: mockExtensionStatus,
      checkExtensionStatus: jest.fn()
    });

    render(<AutoSyncIndicator />);

    const ankiConnectStatus = screen.queryByText('AnkiConnect Status:');
    expect(ankiConnectStatus).not.toBeInTheDocument();
  });

  it('should hide AnkiConnect status when extension is not paired', () => {
    mockExtensionStatus = { available: true, paired: false };
    mockUseExtension.mockReturnValue({
      extensionStatus: mockExtensionStatus,
      checkExtensionStatus: jest.fn()
    });

    render(<AutoSyncIndicator />);

    const ankiConnectStatus = screen.queryByText('AnkiConnect Status:');
    expect(ankiConnectStatus).not.toBeInTheDocument();
  });

  it('should show AnkiConnect status when extension is available and paired', () => {
    mockExtensionStatus = { available: true, paired: true };
    mockUseExtension.mockReturnValue({
      extensionStatus: mockExtensionStatus,
      checkExtensionStatus: jest.fn()
    });

    render(<AutoSyncIndicator />);

    const ankiConnectStatus = screen.getByText('AnkiConnect Status:');
    expect(ankiConnectStatus).toBeInTheDocument();
  });

  it('should disable auto-sync toggle when extension is not available', () => {
    mockExtensionStatus = { available: false, paired: false };
    mockUseExtension.mockReturnValue({
      extensionStatus: mockExtensionStatus,
      checkExtensionStatus: jest.fn()
    });

    render(<AutoSyncIndicator />);

    const autoSyncToggle = screen.getByRole('switch');
    expect(autoSyncToggle).toBeDisabled();
  });

  it('should disable auto-sync toggle when extension is not paired', () => {
    mockExtensionStatus = { available: true, paired: false };
    mockUseExtension.mockReturnValue({
      extensionStatus: mockExtensionStatus,
      checkExtensionStatus: jest.fn()
    });

    render(<AutoSyncIndicator />);

    const autoSyncToggle = screen.getByRole('switch');
    expect(autoSyncToggle).toBeDisabled();
  });

  it('should disable auto-sync toggle when AnkiConnect is not available', () => {
    mockExtensionStatus = { available: true, paired: true };
    mockUseExtension.mockReturnValue({
      extensionStatus: mockExtensionStatus,
      checkExtensionStatus: jest.fn()
    });

    mockHealthStatus = { available: false, configured: true, error: null, lastChecked: new Date(), checking: false };
    mockUseAnkiHealth.mockReturnValue({
      healthStatus: mockHealthStatus,
      checkAnkiHealth: mockCheckAnkiHealth,
      isChecking: false
    });

    render(<AutoSyncIndicator />);

    const autoSyncToggle = screen.getByRole('switch');
    expect(autoSyncToggle).toBeDisabled();
  });

  it('should enable auto-sync toggle when extension is paired and AnkiConnect is available', () => {
    mockExtensionStatus = { available: true, paired: true };
    mockUseExtension.mockReturnValue({
      extensionStatus: mockExtensionStatus,
      checkExtensionStatus: jest.fn()
    });

    mockHealthStatus = { available: true, configured: true, error: null, lastChecked: new Date(), checking: false };
    mockUseAnkiHealth.mockReturnValue({
      healthStatus: mockHealthStatus,
      checkAnkiHealth: mockCheckAnkiHealth,
      isChecking: false
    });

    render(<AutoSyncIndicator />);

    const autoSyncToggle = screen.getByRole('switch');
    expect(autoSyncToggle).not.toBeDisabled();
  });

  it('should show correct description when extension is not available', () => {
    mockExtensionStatus = { available: false, paired: false };
    mockUseExtension.mockReturnValue({
      extensionStatus: mockExtensionStatus,
      checkExtensionStatus: jest.fn()
    });

    render(<AutoSyncIndicator />);

    const description = screen.getByText('JReader extension is not available. Install the extension and keep Anki open with AnkiConnect to enable auto-sync');
    expect(description).toBeInTheDocument();
  });

  it('should show correct description when extension is not paired', () => {
    mockExtensionStatus = { available: true, paired: false };
    mockUseExtension.mockReturnValue({
      extensionStatus: mockExtensionStatus,
      checkExtensionStatus: jest.fn()
    });

    render(<AutoSyncIndicator />);

    const description = screen.getByText('Extension is not paired. Pair the extension to enable auto-sync');
    expect(description).toBeInTheDocument();
  });

  it('should show correct description when AnkiConnect is not configured', () => {
    mockExtensionStatus = { available: true, paired: true };
    mockUseExtension.mockReturnValue({
      extensionStatus: mockExtensionStatus,
      checkExtensionStatus: jest.fn()
    });

    mockHealthStatus = { available: false, configured: false, error: null, lastChecked: new Date(), checking: false };
    mockUseAnkiHealth.mockReturnValue({
      healthStatus: mockHealthStatus,
      checkAnkiHealth: mockCheckAnkiHealth,
      isChecking: false
    });

    render(<AutoSyncIndicator />);

    const description = screen.getByText('Configure AnkiConnect in extension settings to enable auto-sync');
    expect(description).toBeInTheDocument();
  });

  it('should show correct description when AnkiConnect is not running', () => {
    mockExtensionStatus = { available: true, paired: true };
    mockUseExtension.mockReturnValue({
      extensionStatus: mockExtensionStatus,
      checkExtensionStatus: jest.fn()
    });

    mockHealthStatus = { available: false, configured: true, error: null, lastChecked: new Date(), checking: false };
    mockUseAnkiHealth.mockReturnValue({
      healthStatus: mockHealthStatus,
      checkAnkiHealth: mockCheckAnkiHealth,
      isChecking: false
    });

    render(<AutoSyncIndicator />);

    const description = screen.getByText('AnkiConnect is not running. Start Anki to enable auto-sync');
    expect(description).toBeInTheDocument();
  });

  it('should show correct description when everything is ready', () => {
    mockExtensionStatus = { available: true, paired: true };
    mockUseExtension.mockReturnValue({
      extensionStatus: mockExtensionStatus,
      checkExtensionStatus: jest.fn()
    });

    mockHealthStatus = { available: true, configured: true, error: null, lastChecked: new Date(), checking: false };
    mockUseAnkiHealth.mockReturnValue({
      healthStatus: mockHealthStatus,
      checkAnkiHealth: mockCheckAnkiHealth,
      isChecking: false
    });

    mockAutoSyncEnabled = true;
    mockUseAutoSync.mockReturnValue({
      autoSyncEnabled: mockAutoSyncEnabled,
      setAutoSyncEnabled: mockSetAutoSyncEnabled
    });

    render(<AutoSyncIndicator />);

    const description = screen.getByText('Cards will automatically sync to Anki after creation');
    expect(description).toBeInTheDocument();
  });

  it('should show AnkiConnect status with correct state', () => {
    mockExtensionStatus = { available: true, paired: true };
    mockUseExtension.mockReturnValue({
      extensionStatus: mockExtensionStatus,
      checkExtensionStatus: jest.fn()
    });

    mockHealthStatus = { available: true, configured: true, error: null, lastChecked: new Date(), checking: false };
    mockUseAnkiHealth.mockReturnValue({
      healthStatus: mockHealthStatus,
      checkAnkiHealth: mockCheckAnkiHealth,
      isChecking: false
    });

    render(<AutoSyncIndicator />);

    const statusText = screen.getByText('Available');
    expect(statusText).toBeInTheDocument();
  });

  it('should show refresh button for AnkiConnect status', () => {
    mockExtensionStatus = { available: true, paired: true };
    mockUseExtension.mockReturnValue({
      extensionStatus: mockExtensionStatus,
      checkExtensionStatus: jest.fn()
    });

    mockHealthStatus = { available: true, configured: true, error: null, lastChecked: new Date(), checking: false };
    mockUseAnkiHealth.mockReturnValue({
      healthStatus: mockHealthStatus,
      checkAnkiHealth: mockCheckAnkiHealth,
      isChecking: false
    });

    render(<AutoSyncIndicator />);

    // The refresh button is rendered, we can check by finding all buttons
    const buttons = screen.getAllByRole('button');
    // Should have at least 2 buttons: trigger button and refresh button
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('should show "Unavailable" status when AnkiConnect is configured but not running', () => {
    mockExtensionStatus = { available: true, paired: true };
    mockUseExtension.mockReturnValue({
      extensionStatus: mockExtensionStatus,
      checkExtensionStatus: jest.fn()
    });

    mockHealthStatus = { available: false, configured: true, error: null, lastChecked: new Date(), checking: false };
    mockUseAnkiHealth.mockReturnValue({
      healthStatus: mockHealthStatus,
      checkAnkiHealth: mockCheckAnkiHealth,
      isChecking: false
    });

    render(<AutoSyncIndicator />);

    const statusText = screen.getByText('Unavailable');
    expect(statusText).toBeInTheDocument();
  });

  it('should show "Not configured" status when AnkiConnect is not configured', () => {
    mockExtensionStatus = { available: true, paired: true };
    mockUseExtension.mockReturnValue({
      extensionStatus: mockExtensionStatus,
      checkExtensionStatus: jest.fn()
    });

    mockHealthStatus = { available: false, configured: false, error: null, lastChecked: new Date(), checking: false };
    mockUseAnkiHealth.mockReturnValue({
      healthStatus: mockHealthStatus,
      checkAnkiHealth: mockCheckAnkiHealth,
      isChecking: false
    });

    render(<AutoSyncIndicator />);

    const statusText = screen.getByText('Not configured');
    expect(statusText).toBeInTheDocument();
  });
});
