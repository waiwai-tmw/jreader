# JReader Extension - Store Submission Guide

## Overview

The JReader extension provides direct Supabase authentication in the browser extension for seamless reading and Anki sync features.

## Security Architecture

### Authentication Flow
1. **Discord OAuth**: Initiated from the extension popup via `lib/extensionAuth`
2. **PKCE**: Uses Supabase PKCE; on Chrome, completes with the `identity` API and a chromiumapp.org redirect (e.g. `https://<extension-id>.chromiumapp.org/auth-callback`)
3. **Session Storage**: Session stored in extension storage (source of truth in `extensionAuth`)

### Data Handling
- **Stored Data**: Only Supabase session tokens (access_token, refresh_token)
- **Storage Location**: Browser extension storage (local)
- **Data Retention**: Until user signs out or session expires
- **Encryption**: HTTPS in transit. Data is stored locally in the browser's extension storage.
- **Third-Party Sharing**: None

## Build Commands

### Chrome Build
```bash
npm run build:chrome
```

### Firefox Build
```bash
npm run build:firefox
```

### Development
```bash
npm run dev:chrome
```

## Store Listing Content

### Short Description
"Sign in with your JReader account via Supabase to enable seamless reading and Anki sync."

### Detailed Description
```
Sign in with your JReader account in this extension to enable one-click authentication and seamless reading/lookups on JReader.

Features:
• Secure OAuth sign-in using PKCE via Supabase
• Automatic session management with expiration handling
• No third-party data sharing
• Minimal permissions required
• Cross-browser compatibility (Chrome, Firefox, Edge)

This extension requires a JReader account at https://jreader.moe.

Privacy & Security:
• OAuth via Supabase with PKCE
• All communication encrypted via HTTPS
• Session data stored locally in browser storage only
• Automatic cleanup on sign-out or expiration
```

## Chrome Web Store Requirements

### Data Safety Form
**Collected Data:**
- Identifiers/Authentication: Supabase session tokens (access_token, refresh_token)
- Diagnostics: Error logs for debugging (optional)

**Data Sharing:**
- No third-party sharing

**Security:**
- HTTPS in transit. Data is stored locally in the browser's extension storage
- Data deletion: On sign-out or manual request

### Permission Justifications
- **storage**: "Store your authenticated session so you stay logged in across browser sessions"
- **identity (Chrome only)**: "Complete OAuth flow with your chosen provider securely"
- **host_permissions**: "Communicate with jreader.moe, Supabase, and configured API base URL for authentication and syncing"

## Firefox AMO Requirements

### Privacy Policy
```
Data Collection:
We store your Supabase session tokens locally in the browser extension to authenticate requests to JReader services.

Data Usage:
- Session tokens are used solely for API authentication
- No personal data is collected or transmitted beyond authentication
- No tracking or analytics

Data Storage:
- All data is stored locally in your browser
- Data is transmitted over HTTPS encryption
- No third-party services receive your data

Data Control:
- You can remove your session at any time via the extension's sign-out feature
- Extension data is automatically cleared when the extension is removed

Contact: support@jreader.moe
```

## Required Assets

### Icons
Create icons in the following sizes:
- 16x16px (toolbar)
- 32x32px (Windows)
- 48x48px (extension management)
- 128x128px (store listing)

### Screenshots
- Chrome: 1280x800px minimum
- Firefox: 1280x800px minimum
- Show: Pairing UI, Connected state, Settings page

### Store Metadata
- **Website**: https://jreader.moe
- **Support**: support@jreader.moe
- **Privacy Policy**: https://jreader.moe/privacy
- **Source Code**: https://github.com/jreader/extension (if requested)

## Reviewer Documentation

### How Authentication Works
1. Extension initiates Discord OAuth using Supabase with PKCE via `lib/extensionAuth`
2. On Chrome, OAuth completes using the `identity` permission and the chromiumapp.org redirect URL returned by `chrome.identity.getRedirectURL('auth-callback')`
3. Supabase exchanges the authorization code for a session
4. Session is stored in extension storage and used for authenticated API calls (source of truth held by `extensionAuth`)

### Security Measures
- PKCE-based OAuth flow with state/verifier managed by Supabase client in `extensionAuth`
- Strict origin validation for any web app messaging
- No eval or unsafe-eval in CSP
- All external requests over HTTPS

### Data Flow
```
User → Extension (OAuth) → Supabase → Background Script → Storage
```

No data flows to third parties. All communication is between the user's browser and jreader.moe services.

## Pre-Submission Checklist

### Security
- [x] Web Crypto API for nonce generation
- [x] TTL enforcement (2 minutes)
- [x] One-time use validation
- [x] Origin validation
- [x] Content script isolation
- [x] CSP without eval

### Permissions
- [x] Minimal permissions
- [x] `storage` (persist session locally)
- [x] `identity` (Chrome only, to complete OAuth via `launchWebAuthFlow`)
- [x] Host permissions only for required domains

### Code Quality
- [x] TypeScript with strict types
- [x] Comprehensive error handling
- [x] User-friendly notifications
- [x] Session validation and cleanup

### Store Compliance
- [x] Chrome and Firefox manifests
- [x] Privacy policy prepared
- [x] Data safety documentation
- [x] Permission justifications
- [x] Reviewer documentation

## Testing

### Manual Testing
1. Test Discord OAuth flow from extension popup
2. Verify session persistence across browser restarts
3. Test session persistence across browser restarts
4. Verify sign-out clears all data
5. Test error handling and user notifications

### Automated Testing
```bash
npm test
npm run test:coverage
```

## Submission Process

### Chrome Web Store
1. Build Chrome version: `npm run build:chrome`
2. Create developer account
3. Upload ZIP of dist/ folder
4. Fill Data Safety form
5. Provide permission justifications
6. Submit for review

### Firefox AMO
1. Build Firefox version: `npm run build:firefox`
2. Create developer account
3. Upload ZIP of dist/ folder
4. Provide privacy policy
5. Submit for review

## Post-Submission

### Monitoring
- Monitor store reviews and ratings
- Track user feedback and support requests
- Monitor error logs for issues

### Updates
- Use semantic versioning
- Test thoroughly before updates
- Document changes in release notes
