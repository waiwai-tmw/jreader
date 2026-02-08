# JReader Chrome Extension

A modern Chrome extension that integrates with JReader's web app using Supabase authentication.

## Features

- **Modern 2025 Setup**: Uses esbuild + TypeScript + native ESM (no webpack)
- **Cross-Browser Support**: Works with Chrome, Firefox, Edge, and other Chromium-based browsers
- **Supabase Integration**: Official Supabase client with session sharing from web app
- **Supabase Auth**: Direct OAuth (Discord) sign-in within the extension
- **Session Persistence**: Stores authentication state in browser storage
- **Theme Support**: Light/dark/system theme switching with semantic color system
- **Comprehensive Testing**: 54 tests covering unit, integration, and configuration testing
- **Developer Experience**: Hot reload, TypeScript, and comprehensive logging for debugging

## Development

### Prerequisites

- Node.js 18+
- Chrome browser for testing

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the extension:**
   ```bash
   # For Chrome
   npm run build:chrome:dev    # Development build
   npm run build:chrome:prod   # Production build

   # For Firefox
   npm run build:firefox:dev   # Development build
   npm run build:firefox:prod  # Production build
   ```

3. **Load the extension in Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` folder

### Development Commands

#### Build Commands
- `npm run build:chrome:dev` - Development build for Chrome
- `npm run build:chrome:prod` - Production build for Chrome
- `npm run build:firefox:dev` - Development build for Firefox
- `npm run build:firefox:prod` - Production build for Firefox
- `npm run dev:chrome` - Development mode for Chrome (auto-rebuilds on file changes)
- `npm run dev:firefox` - Development mode for Firefox (auto-rebuilds on file changes)
- `npm run clean` - Remove build artifacts

**Note:** Build commands require both browser target and environment (dev/prod) to be specified. The generic `npm run build` command will show usage instructions if run without proper parameters. Watch mode commands (`dev:*`) always use the development environment.

#### Type Checking
- `npm run typecheck` - Run TypeScript type checking

#### Testing Commands
- `npm test` - Run all tests once (CI/CI-friendly)
- `npm run test:watch` - Run tests in watch mode (development)
- `npm run test:ui` - Open interactive test UI
- `npm run test:coverage` - Run tests with coverage report

### Development Workflow

1. **Start development mode:**
   ```bash
   # Choose one target
   npm run dev:chrome
   # or
   npm run dev:firefox
   ```
   This will build the extension and watch for changes, automatically rebuilding when you modify source files.

## Theme System

The extension includes a comprehensive theme system with the following features:

### Available Themes
- **Light**: Clean, bright interface optimized for daytime use
- **Dark**: Dark interface optimized for low-light environments  
- **System**: Automatically follows your system's light/dark mode preference

### Theme Components
- **ThemeProvider**: React context that manages theme state and persistence
- **ThemeToggle**: UI component with three-button toggle (Light/Dark/System)
- **Semantic Colors**: All UI elements use CSS custom properties that automatically adapt to the selected theme

### Implementation Details
- Themes are stored in Chrome's local storage (`jreader-extension-theme` key)
- System theme detection uses `prefers-color-scheme` media query
- All colors use semantic naming (e.g., `bg-background`, `text-foreground`) for consistency
- Theme changes are applied instantly without page reload
- Theme synchronization between popup and settings pages via Chrome storage events

### Usage
The theme toggle is available in both the popup and settings pages. Users can switch between themes at any time, and their preference will be remembered across sessions.

2. **Make changes to source files** in the `src/` directory

3. **Reload the extension** in Chrome:
   - Go to `chrome://extensions/`
   - Click the refresh icon on your JReader extension

4. **Test your changes** by interacting with the extension

### Testing

The extension includes a comprehensive test suite using Vitest:

#### Running Tests
```bash
# Run all tests once
npm run test:run

# Run tests in watch mode (development)
npm run test:watch

# Open interactive test UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

#### Test Coverage
- **Unit Tests**: Browser utilities, validation functions, message processing
- **Integration Tests**: Message flow between components
- **Configuration Tests**: Manifest generation for different browsers
- **54 tests** covering all major functionality

See [TESTING.md](./TESTING.md) for detailed testing documentation.

### For Team Members

When cloning the repository:

```bash
git clone <repository-url>
cd jreader-extension
npm install          # Recreates node_modules and package-lock.json
npm run build        # Recreates dist/ folder
```

**Note:** The `node_modules/`, `dist/`, and `package-lock.json` files are not committed to git. They are generated locally by running the commands above.

## Icons

The extension uses a comprehensive icon system that provides appropriate sizes for all browser contexts:

### Icon Sizes and Usage
- **16x16**: Favicon and extension list
- **32x32**: Windows taskbar
- **48x48**: Extension management page
- **64x64**: Windows high-DPI displays
- **96x96**: Extension management page on high-DPI displays
- **128x128**: Chrome Web Store and Firefox Add-ons marketplace

### Source Icon
The source icon is an SVG file (`icon.svg`) that gets automatically converted to various PNG sizes during build. The SVG uses a royal blue background with a white eye design and the kanji 日, making it easily recognizable in all sizes.

### Generating Icons
Icons are automatically generated using the `scripts/generate-icons.js` script:

```bash
# Install dependencies (if not already installed)
npm install

# Generate all icon sizes
node scripts/generate-icons.js
```

This will create PNG versions of all required sizes in the `icons/` directory. The manifest files are already configured to use these icons appropriately.

### Icon Configuration
Both Chrome and Firefox manifests include the icon configuration:

```json
{
  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "64": "icons/icon-64.png",
    "96": "icons/icon-96.png",
    "128": "icons/icon-128.png"
  }
}
```

## Architecture

### File Structure

```
.
├── icon.svg               # Source icon file
├── scripts/
│   └── generate-icons.js  # Icon generation script
├── src/
│   ├── sw-main.ts              # Service worker entry (MV3)
│   ├── content.ts              # Content script
│   ├── content-debug.ts        # Optional verbose logging content script (dev only)
│   ├── popup.tsx               # Popup UI entry
│   ├── settings.tsx            # Options/settings page entry
│   └── lib/
│       ├── extensionAuth.ts    # Centralized Supabase auth/client for the extension
│       ├── authErrorHandler.ts # Centralized auth error handling helpers
│       └── authNotificationHandler.ts # Auth notifications
├── icons/                 # Generated icon files
│   ├── icon-16.png       # Favicon and extension list
│   ├── icon-32.png       # Windows taskbar
│   ├── icon-48.png       # Extension management page
│   ├── icon-64.png       # Windows high-DPI displays
│   ├── icon-96.png       # Extension management page (high-DPI)
│   └── icon-128.png      # Web stores
└── dist/                  # Built extension files
    ├── background.js           # Service worker bundle (Chrome)
    ├── background.firefox.js   # Service worker bundle (Firefox)
    ├── content.js              # Content script bundle
    ├── popup.js                # Popup bundle
    ├── settings.js             # Options/settings bundle
    ├── options.html            # Generated options page
    └── manifest.json           # Copied from manifest.*.json for target
```

### Authentication Flow

1. **Sign-in (Discord OAuth)**: Initiated from the popup; handled by `lib/extensionAuth.ts` using Supabase OAuth with PKCE
2. **Chrome Identity**: On Chrome, uses the `identity` permission to complete the OAuth flow safely
3. **Session Source of Truth**: `extensionAuth` owns the Supabase client and session; the service worker calls into it
4. **Session Persistence**: Session is stored in extension storage and rehydrated on-demand in the service worker

### Security

- **Origin Validation**: Content script validates message origins for web app messaging
- **PKCE OAuth**: Secure sign-in using PKCE via Supabase
- **Extension Storage**: Session and settings are stored in extension storage (`browser.storage.local` / `session`)
- **RLS**: Supabase Row Level Security protects user data

## Configuration

### Supabase Setup

You can configure Supabase in two ways:

1. **Build-time**: Put `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env.local` (used by the build).
2. **Runtime**: In the extension settings page, set `supabase_url` and `supabase_anon_key` (stored in extension storage and used by the service worker).

### Content Script Origins

Update the allowed origins in `src/content.ts`:

```typescript
const isAllowedOrigin = (origin: string) => {
  return origin.includes('localhost') || 
         origin.includes('your-domain.com');
};
```

## API

### Background Script Messages (examples)

- `auth.signInDiscord` - Start Discord OAuth sign-in
- `auth.signOut` - Sign out and clear session
- `supabase.getUser` - Get current authenticated user
- `supabase.getCards` - Fetch recent cards
- `anki.syncCards` - Build plan via server and push to AnkiConnect
- `anki.checkHealth` - Check AnkiConnect availability

### Content Script Messages

- `extensionCheck` - Frontend checks extension availability and auth state

## Deployment

1. Build the extension for production:
   ```bash
   # For Chrome Web Store
   npm run build:chrome:prod

   # For Firefox Add-ons
   npm run build:firefox:prod
   ```
2. Zip the `dist` folder contents
3. Upload to Chrome Web Store or distribute as unpacked extension

## Troubleshooting

### Common Issues

1. **Extension not loading**: Check background and content script consoles
2. **Session not persisting**: Verify extension storage and that `extensionAuth` is configured
3. **Supabase connection fails**: Confirm Supabase URL/key configured (settings or `.env.local`)
4. **Auth fails**: Verify OAuth redirect setup, Chrome `identity` permission (Chrome), and Supabase keys

### Debug Mode

Enable debug logging by opening Chrome DevTools:
- Background script: `chrome://extensions/` → Extension details → Inspect views: background page
- Content script: Any web page → DevTools → Console
- Popup: Right-click extension icon → Inspect popup

## Third-party dependencies

How to check licenses:
```
% npx license-checker --json > licenses.json
% less licenses.json
% jq -r 'to_entries[] | "\(.key)\t\(.value.licenses)"' licenses.json \
  | rg -i 'gpl|agpl|lgpl|sspl|commons'
```

This project uses the `sharp` library for image processing.

`sharp` dynamically links to libvips via prebuilt binaries distributed
by the `sharp` project. According to the sharp maintainers, this usage
does not require LGPL compliance by downstream projects, provided that
prebuilt binaries are used and libvips is not statically linked.

See: https://github.com/lovell/sharp/issues/3565
