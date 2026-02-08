import { render, screen } from '@testing-library/react';
import React from 'react';

import '@testing-library/jest-dom';
import { BaseHeader } from '../BaseHeader';

import { AnkiHealthProvider } from '@/contexts/AnkiHealthContext';
import { AutoSyncProvider } from '@/contexts/AutoSyncContext';
import { ExtensionProvider } from '@/contexts/ExtensionContext';

// Mock hooks and contexts
jest.mock('@/hooks/useIsSafari', () => ({
  useIsSafari: () => false
}));

jest.mock('@/hooks/useShowExtensionComponents', () => ({
  useShowExtensionComponents: () => true
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    signIn: jest.fn(),
    signOut: jest.fn(),
    signUp: jest.fn(),
    resetPassword: jest.fn(),
    updatePassword: jest.fn(),
    updateEmail: jest.fn(),
    updateProfile: jest.fn(),
    isAuthenticated: false
  })
}));

// Mock the child components
jest.mock('@/components/ExtensionIndicator', () => ({
  ExtensionIndicator: () => <div data-testid="extension-indicator">Extension</div>
}));

jest.mock('@/components/AutoSyncIndicator', () => ({
  AutoSyncIndicator: () => <div data-testid="auto-sync-indicator">AutoSync</div>
}));

jest.mock('@/components/ui/sidebar', () => ({
  SidebarTrigger: ({ className }: { className?: string }) => (
    <button data-testid="sidebar-trigger" className={className}>Menu</button>
  )
}));

// Wrapper component to provide all necessary contexts
// Order matters: ExtensionProvider -> AutoSyncProvider -> AnkiHealthProvider
// because AnkiHealthProvider depends on AutoSyncProvider
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ExtensionProvider>
    <AutoSyncProvider>
      <AnkiHealthProvider>
        {children}
      </AnkiHealthProvider>
    </AutoSyncProvider>
  </ExtensionProvider>
);

describe('BaseHeader', () => {
  it('should render with title and include extension indicator and auto sync indicator', () => {
    render(<BaseHeader title="Test Page" />, { wrapper: TestWrapper });

    expect(screen.getByText('Test Page')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-trigger')).toBeInTheDocument();
    expect(screen.getByTestId('extension-indicator')).toBeInTheDocument();
    expect(screen.getByTestId('auto-sync-indicator')).toBeInTheDocument();
  });

  it('should render without title', () => {
    render(<BaseHeader />, { wrapper: TestWrapper });

    expect(screen.queryByText('Test Page')).not.toBeInTheDocument();
    expect(screen.getByTestId('sidebar-trigger')).toBeInTheDocument();
    expect(screen.getByTestId('extension-indicator')).toBeInTheDocument();
    expect(screen.getByTestId('auto-sync-indicator')).toBeInTheDocument();
  });

  it('should render with children', () => {
    render(
      <BaseHeader title="Test Page">
        <div data-testid="custom-child">Custom Content</div>
      </BaseHeader>,
      { wrapper: TestWrapper }
    );

    expect(screen.getByText('Test Page')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-trigger')).toBeInTheDocument();
    expect(screen.getByTestId('extension-indicator')).toBeInTheDocument();
    expect(screen.getByTestId('auto-sync-indicator')).toBeInTheDocument();
    expect(screen.getByTestId('custom-child')).toBeInTheDocument();
  });

  it('should have correct header structure', () => {
    render(<BaseHeader title="Test Page" />, { wrapper: TestWrapper });

    const header = screen.getByRole('banner');
    expect(header).toHaveClass('flex', 'h-10', 'shrink-0', 'items-center', 'gap-2', 'border-b', 'z-[5]', 'relative', 'bg-background', 'pr-2');
  });

  it('should render auto sync indicator without context dependencies', () => {
    render(<BaseHeader title="Test Page" />, { wrapper: TestWrapper });

    expect(screen.getByTestId('auto-sync-indicator')).toBeInTheDocument();
  });
});
