import { getSiteUrl } from './getSiteUrl';

// Test cases for getSiteUrl utility
describe('getSiteUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should use RENDER_EXTERNAL_URL for pull request previews', () => {
    process.env['IS_PULL_REQUEST'] = 'true';
    process.env['RENDER_EXTERNAL_URL'] = 'https://jreader-frontend-pr-9.onrender.com';
    process.env['NEXT_PUBLIC_SITE_URL'] = 'https://jreader.moe';

    expect(getSiteUrl()).toBe('https://jreader-frontend-pr-9.onrender.com');
  });

  it('should remove trailing slash from RENDER_EXTERNAL_URL', () => {
    process.env['IS_PULL_REQUEST'] = 'true';
    process.env['RENDER_EXTERNAL_URL'] = 'https://jreader-frontend-pr-9.onrender.com/';
    process.env['NEXT_PUBLIC_SITE_URL'] = 'https://jreader.moe';

    expect(getSiteUrl()).toBe('https://jreader-frontend-pr-9.onrender.com');
  });

  it('should use NEXT_PUBLIC_SITE_URL for production', () => {
    process.env['IS_PULL_REQUEST'] = 'false';
    process.env['RENDER_EXTERNAL_URL'] = 'https://jreader-frontend.onrender.com';
    process.env['NEXT_PUBLIC_SITE_URL'] = 'https://jreader.moe';

    expect(getSiteUrl()).toBe('https://jreader.moe');
  });

  it('should remove trailing slash from NEXT_PUBLIC_SITE_URL', () => {
    process.env['IS_PULL_REQUEST'] = 'false';
    process.env['RENDER_EXTERNAL_URL'] = 'https://jreader-frontend.onrender.com';
    process.env['NEXT_PUBLIC_SITE_URL'] = 'https://jreader.moe/';

    expect(getSiteUrl()).toBe('https://jreader.moe');
  });

  it('should throw error when RENDER_EXTERNAL_URL is missing for pull request', () => {
    process.env['IS_PULL_REQUEST'] = 'true';
    delete process.env['RENDER_EXTERNAL_URL'];
    process.env['NEXT_PUBLIC_SITE_URL'] = 'https://jreader.moe';

    expect(() => getSiteUrl()).toThrow('RENDER_EXTERNAL_URL environment variable is missing');
  });

  it('should throw error when NEXT_PUBLIC_SITE_URL is missing for production', () => {
    process.env['IS_PULL_REQUEST'] = 'false';
    process.env['RENDER_EXTERNAL_URL'] = 'https://jreader-frontend-pr-9.onrender.com';
    delete process.env['NEXT_PUBLIC_SITE_URL'];

    expect(() => getSiteUrl()).toThrow('NEXT_PUBLIC_SITE_URL environment variable is missing');
  });
});
