import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import '@testing-library/jest-dom';
import { SettingsButton } from '../SettingsButton';

// Mock the dropdown menu to always show content
jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-trigger">{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <div data-testid="dropdown-menu-item" onClick={onClick}>{children}</div>
  ),
  DropdownMenuSeparator: () => <div data-testid="dropdown-menu-separator" />,
}));

// Mock functions for contexts
const mockUpdateSetting = jest.fn();
const mockToggleEinkMode = jest.fn();

// Mock the settings context
jest.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({
    fontSize: 1.0,
    verticalMargin: 2.0,
    updateSetting: mockUpdateSetting
  })
}));

// Mock the eink mode context
jest.mock('@/contexts/EinkModeContext', () => ({
  useEinkMode: () => ({
    isEinkMode: false,
    toggleEinkMode: mockToggleEinkMode
  })
}));

// Mock theme-toggle-eink
jest.mock('@/components/theme-toggle-eink', () => ({
  ThemeToggleEink: () => <div data-testid="theme-toggle">Theme Toggle</div>
}));

// Mock next-themes to avoid AggregateError
jest.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: jest.fn(),
    resolvedTheme: 'light'
  })
}));

// Mock window.matchMedia for ThemeProvider
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('SettingsButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render settings button', () => {
    render(<SettingsButton />);

    const settingsButton = screen.getAllByRole('button')[0];
    expect(settingsButton).toBeInTheDocument();
  });

  it('should render font size slider', () => {
    render(<SettingsButton />);

    const fontSizeLabel = screen.getByText(/Font Size:/);
    expect(fontSizeLabel).toBeInTheDocument();
    expect(fontSizeLabel).toHaveTextContent('Font Size: 1x');
  });

  it('should render vertical margin slider', () => {
    render(<SettingsButton />);

    const verticalMarginLabel = screen.getByText(/Vertical Margin:/);
    expect(verticalMarginLabel).toBeInTheDocument();
    expect(verticalMarginLabel).toHaveTextContent('Vertical Margin: 2vh');
  });

  it('should render theme toggle', () => {
    render(<SettingsButton />);

    const themeLabel = screen.getByText('Theme');
    expect(themeLabel).toBeInTheDocument();

    const themeToggle = screen.getByTestId('theme-toggle');
    expect(themeToggle).toBeInTheDocument();
  });

  it('should render e-ink mode toggle', () => {
    render(<SettingsButton />);

    const einkLabel = screen.getByText('E-ink Mode');
    expect(einkLabel).toBeInTheDocument();

    const einkSwitch = screen.getByRole('switch');
    expect(einkSwitch).toBeInTheDocument();
    expect(einkSwitch).not.toBeChecked();
  });

  it('should render theme description', () => {
    render(<SettingsButton />);

    const themeDescription = screen.getByText('Choose light, dark, or system theme');
    expect(themeDescription).toBeInTheDocument();
  });

  it('should render e-ink mode description', () => {
    render(<SettingsButton />);

    const einkDescription = screen.getByText('Disable all animations and transitions');
    expect(einkDescription).toBeInTheDocument();
  });

  it('should have correct slider values', () => {
    render(<SettingsButton />);

    const sliders = screen.getAllByRole('slider');
    expect(sliders).toHaveLength(2);

    // Font size slider (first)
    expect(sliders[0]).toHaveAttribute('aria-valuenow', '1');
    expect(sliders[0]).toHaveAttribute('aria-valuemin', '0.5');
    expect(sliders[0]).toHaveAttribute('aria-valuemax', '2');

    // Vertical margin slider (second)
    expect(sliders[1]).toHaveAttribute('aria-valuenow', '2');
    expect(sliders[1]).toHaveAttribute('aria-valuemin', '0.5');
    expect(sliders[1]).toHaveAttribute('aria-valuemax', '5');
  });

  it('should call toggleEinkMode when e-ink switch is clicked', () => {
    render(<SettingsButton />);

    const einkSwitch = screen.getByRole('switch');
    fireEvent.click(einkSwitch);

    expect(mockToggleEinkMode).toHaveBeenCalledTimes(1);
  });
});
