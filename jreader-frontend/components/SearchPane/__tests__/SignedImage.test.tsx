/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor, act } from '@testing-library/react';
import React from 'react';

import '@testing-library/jest-dom';
import { SignedImage } from '../Definition';

// Mock AuthContext
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user' },
    loading: false,
    signIn: jest.fn(),
    signOut: jest.fn(),
    signUp: jest.fn(),
    resetPassword: jest.fn(),
    updatePassword: jest.fn(),
    updateEmail: jest.fn(),
    updateProfile: jest.fn(),
    isAuthenticated: true
  })
}));

// Mock fetch
global.fetch = jest.fn();

describe('SignedImage component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show loading state initially', async () => {
    // Mock fetch to never resolve (simulating loading state)
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));

    render(<SignedImage path="test-image.png" />);

    // Should show loading spinner
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('should load and display image successfully', async () => {
    const mockSignedUrl = 'https://example.com/signed-image-url.png';
    (global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ url: mockSignedUrl })
      })
    );

    render(<SignedImage path="test-image.png" />);

    // Wait for the image to appear
    const img = await screen.findByTestId('signed-image');
    expect(img).toHaveAttribute('src', mockSignedUrl);
    expect(img).toHaveAttribute('alt', '');
  });

  it('should handle fetch error gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    await act(async () => {
      render(<SignedImage path="test-image.png" />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('image-error')).toBeInTheDocument();
    });
  });

  it('should handle non-ok response gracefully', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500
    });

    await act(async () => {
      render(<SignedImage path="test-image.png" />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('image-error')).toBeInTheDocument();
    });
  });

  it('should apply custom width and height', async () => {
    const mockSignedUrl = 'https://example.com/signed-image-url.png';
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: mockSignedUrl })
    });

    await act(async () => {
      render(
        <SignedImage
          path="test-image.png"
          width="200px"
          height="150px"
        />
      );
    });

    const img = await screen.findByTestId('signed-image');
    expect(img.getAttribute('style')).toContain('width: 200px');
    expect(img.getAttribute('style')).toContain('height: 150px');
  });

  it('should apply vertical alignment', async () => {
    const mockSignedUrl = 'https://example.com/signed-image-url.png';
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: mockSignedUrl })
    });

    await act(async () => {
      render(
        <SignedImage
          path="test-image.png"
          verticalAlign="top"
        />
      );
    });

    const img = await screen.findByTestId('signed-image');
    expect(img.getAttribute('style')).toContain('vertical-align: top');
  });

  it('should call sign-image-url with correct path', async () => {
    const mockSignedUrl = 'https://example.com/signed-image-url.png';
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: mockSignedUrl })
    });

    await act(async () => {
      render(<SignedImage path="test-image.png" />);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/sign-image-url?path=test-image.png'
      );
    });
  });

  it('should handle complex paths with special characters', async () => {
    const mockSignedUrl = 'https://example.com/signed-image-url.png';
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: mockSignedUrl })
    });

    const complexPath = 'ja.Wikipedia.2022-12-01.v1.6.1/assets/wikipedia-icon.png';
    await act(async () => {
      render(<SignedImage path={complexPath} />);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/sign-image-url?path=${encodeURIComponent(complexPath)}`
      );
    });
  });

  it('should re-fetch when path changes', async () => {
    const mockSignedUrl1 = 'https://example.com/signed-image-url-1.png';
    const mockSignedUrl2 = 'https://example.com/signed-image-url-2.png';

    // Track which path was requested to return the correct URL
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('image1.png')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ url: mockSignedUrl1 })
        });
      } else if (url.includes('image2.png')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ url: mockSignedUrl2 })
        });
      }
      return Promise.reject(new Error('Unexpected path'));
    });

    const { rerender } = render(<SignedImage path="image1.png" />);

    const img1 = await screen.findByTestId('signed-image');
    expect(img1).toHaveAttribute('src', mockSignedUrl1);

    rerender(<SignedImage path="image2.png" />);

    await waitFor(() => {
      const img2 = screen.getByTestId('signed-image');
      expect(img2).toHaveAttribute('src', mockSignedUrl2);
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/sign-image-url?path=image1.png');
    expect(global.fetch).toHaveBeenCalledWith('/api/sign-image-url?path=image2.png');
  });
});
