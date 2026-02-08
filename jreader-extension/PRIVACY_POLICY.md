# JReader Extension Privacy Policy

**Last Updated: January 2025**

## Overview

The JReader browser extension ("Extension") is designed to securely pair your JReader account with your browser for enhanced reading and lookup features. This privacy policy explains how we handle your data.

## Data Collection

### What We Collect
The Extension collects minimal data necessary for authentication and local syncing configuration:
- **Authentication Tokens**: Supabase session tokens (access_token, refresh_token)
- **Local Sync Settings**: AnkiConnect URL, selected deck, and note type (stored locally for syncing)
- **Device Information**: Browser type and extension version (for debugging)

### What We Don't Collect
- Personal information beyond authentication
- Browsing history or web activity
- Location data
- Analytics or tracking data
- Third-party data

## Data Storage

### Local Storage Only
- All data is stored locally in your browser's extension storage
- Data is transmitted only to JReader/Supabase and your locally configured AnkiConnect endpoint for syncing, over HTTPS or HTTP as configured by the user for AnkiConnect
- Session tokens are encrypted in transit via HTTPS

### Data Retention
- Session tokens are stored until you sign out or they expire
- No persistent data is retained after extension removal
- Automatic cleanup occurs on session expiration

## Data Usage

### Authentication and Sync
- Session tokens are used solely for authenticating API requests to JReader services
- Anki settings are used locally to communicate with your AnkiConnect instance to store media and notes
- No data is shared with third parties
- No tracking or analytics are performed

### Communication
- All communication is encrypted via HTTPS
- Only necessary authentication data is transmitted
- No personal data is processed beyond authentication

## Data Control

### Your Rights
- **Access**: View stored data via browser extension storage
- **Deletion**: Remove all data by signing out or uninstalling the extension
- **Portability**: Export your data via JReader web application

### Data Deletion
- Sign out through the extension interface
- Uninstall the extension
- Clear browser extension data
- Session tokens automatically expire

## Security

### Encryption
- All data transmission uses HTTPS encryption
- Data is stored locally in your browser's extension storage
- Secure token generation using Web Crypto API

### Access Controls
- Only you can access your stored session data
- No server-side storage of extension data
- Strict origin validation prevents unauthorized access

## Third-Party Services

### Supabase
- We use Supabase for authentication services
- Supabase's privacy policy applies to their services
- No data is shared beyond necessary authentication

### No Other Third Parties
- No analytics services
- No advertising networks
- No tracking services
- No data brokers

## Children's Privacy

This Extension is not intended for children under 13. We do not knowingly collect personal information from children under 13.

## Changes to This Policy

We may update this privacy policy periodically. Changes will be posted on this page with an updated "Last Updated" date.

## Contact

For questions about this privacy policy or data handling:
- Email: privacy@jreader.moe
- Website: https://jreader.moe/privacy

## Compliance

This Extension complies with:
- Browser extension store policies (Chrome Web Store, Firefox AMO)
- GDPR (for EU users)
- CCPA (for California users)
- Other applicable privacy laws

---

**JReader Extension Privacy Policy v1.0**
