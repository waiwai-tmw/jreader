export const getSiteUrl = (): string => {
  // Check if this is a pull request preview
  const isPullRequest = process.env['IS_PULL_REQUEST'] === 'true';

  if (isPullRequest) {
    // Use the Render external URL for PR previews
    const renderUrl = process.env['RENDER_EXTERNAL_URL'];
    if (!renderUrl) {
      throw new Error('RENDER_EXTERNAL_URL environment variable is missing. This should be automatically set by Render for pull request previews.');
    }
    return removeTrailingSlash(renderUrl);
  } else {
    // Use the configured site URL for production/localhost
    const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'];
    if (!siteUrl) {
      throw new Error('NEXT_PUBLIC_SITE_URL environment variable is missing. This should be set in your .env.local file.');
    }
    return removeTrailingSlash(siteUrl);
  }
};

// Helper function to remove trailing slash from a URL
const removeTrailingSlash = (url: string): string => {
  return url.endsWith('/') ? url.slice(0, -1) : url;
};
