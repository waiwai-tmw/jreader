# JReader Extension - Reviewer Packet

## Quick Start for Reviewers

### What This Extension Does
The JReader extension provides direct Supabase authentication within the extension for reading and lookup features.

### Key Features
- **Direct OAuth**: Discord sign-in via Supabase PKCE
- **Session Management**: Automatic Supabase session handling
- **Minimal Permissions**: Only storage
- **Cross-Browser**: Compatible with Chrome, Firefox, and Edge

## Authentication Flow (For Reviewers)

### Step-by-Step Process
1. **User Initiation**: User clicks "Sign in with Discord" in the extension popup
2. **OAuth Flow**: Handled by `lib/extensionAuth` using Supabase OAuth with PKCE. On Chrome, the flow completes using the `identity` permission and the chromiumapp.org redirect URL returned by `chrome.identity.getRedirectURL('auth-callback')`.
3. **Code Exchange**: Supabase exchanges authorization code for a session
4. **Completion**: Session is stored in extension storage and used for API calls (the service worker calls into `extensionAuth` as source of truth)

### Security Measures
- **PKCE**: Secure OAuth with PKCE
- **Origin Validation**: Only accepts messages from trusted JReader origins
- **No Remote Code**: All code bundled locally

## Data Handling

### What We Store
- **Supabase Session Tokens**: access_token, refresh_token (for API authentication)

### What We Don't Store
- Personal information beyond authentication
- Browsing history or web activity
- Analytics or tracking data
- Third-party data

### Data Flow
```
User → Extension (OAuth) → Supabase → Background Script → Local Storage
```

**No data flows to third parties.** All communication is between the user's browser and jreader.moe services.

## Technical Implementation

### Architecture
- **Manifest V3**: Uses modern service worker architecture
- **TypeScript**: Full type safety throughout
- **Web Crypto API**: Secure random number generation
- **HTTPS Only**: All external communication encrypted
- **CSP Compliant**: No eval or unsafe-eval

### Permissions Justification
- **storage**: Store authentication session locally
- **identity (Chrome only)**: Complete OAuth flow securely
- **host_permissions**: Communicate with jreader.moe, Supabase, and the configured API base URL

### Content Scripts
- **content.ts**: General web app communication
- **Origin Validation**: Strict allowlist for trusted domains

## Security Validation

### OAuth Security
```typescript
// PKCE handled by Supabase client in extensionAuth; state/verifier are managed by Supabase auth
```

### Origin Validation
```typescript
const ALLOWED_ORIGINS = new Set([
  'https://jreader.moe',
  // Development origins only
  'http://localhost:3000',
  'https://localhost:3000'
]);
```

### Message Validation
- Type checking for all messages
- Schema validation for payloads
- Source validation (event.source === window)

## Testing Instructions

### Manual Testing
1. Install extension in developer mode
2. Click "Sign in with Discord" in the popup
3. Complete OAuth and verify authenticated state
4. Test sign-out clears all data

### Security Testing
1. Verify OAuth completes only via allowed redirect URL
2. Verify session cannot be read by web pages
3. Verify content script origin validation

## Compliance

### Chrome Web Store
- ✅ Manifest V3 compliant
- ✅ No remote code execution
- ✅ Minimal permissions
- ✅ Clear data handling practices
- ✅ CSP compliant

### Firefox AMO
- ✅ Manifest V3 compatible
- ✅ No Chrome-specific APIs
- ✅ Privacy policy provided
- ✅ Open source available (if requested)

## Common Reviewer Questions

### Q: Why does this extension need storage permission?
**A**: To store the user's Supabase authentication session locally so they remain logged in across browser sessions.

### Q: What data is transmitted to external services?
**A**: Only Supabase session tokens for API authentication. No personal data, browsing history, or analytics are transmitted.

### Q: How does the pairing process work?
**A**: The extension generates a secure nonce, opens the web app's pairing page, and receives session data through a secure message channel. The nonce expires after 2 minutes and can only be used once.

### Q: Is this extension safe for users?
**A**: Yes. The extension uses industry-standard security practices including Web Crypto API, HTTPS encryption, origin validation, and minimal data collection.

## Contact Information

- **Developer**: JReader Team
- **Website**: https://jreader.moe
- **Support**: support@jreader.moe
- **Privacy**: privacy@jreader.moe

## Additional Resources

- **Source Code**: Available upon request
- **Privacy Policy**: https://jreader.moe/privacy
- **Terms of Service**: https://jreader.moe/terms
- **Documentation**: https://jreader.moe/docs

---

**This packet provides reviewers with all necessary information to evaluate the JReader extension's security, privacy, and compliance with store policies.**
