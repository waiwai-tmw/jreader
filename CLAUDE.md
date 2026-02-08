# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JReader is a Japanese reading and learning platform consisting of three main components:
1. **jreader-frontend**: Next.js 15 web application (main user interface)
2. **jreader-extension**: Chrome/Firefox browser extension for Anki integration
3. **jreader-rs**: Rust backend service for dictionary lookups and file processing

## Development Commands

### Frontend (jreader-frontend)
```bash
# Development (uses .next-dev directory)
npm run dev              # Start Next.js dev server (localhost:3000)

# Production (uses .next-prod directory)
npm run build           # Production build (checks extension constants)
npm start               # Start production server (localhost:3000 by default)

# E2E Testing (uses .next-prod directory)
npm run test:e2e                                        # Run all e2e tests
npm run test:e2e -- e2e/spoiler-state-reset.spec.ts   # Run specific e2e test file

# Unit Testing
npm test                # Run Jest tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Generate coverage report

# Examples from README
npm test -- --testPathPatterns="ext-auth"              # Run ext-auth tests
npm test -- app/api/ext-auth/start/route.test.ts      # Run specific test file
```

### Extension (jreader-extension)
```bash
# Build commands (must specify target and environment)
npm run build:chrome:dev     # Chrome development build
npm run build:chrome:prod    # Chrome production build
npm run build:firefox:dev    # Firefox development build
npm run build:firefox:prod   # Firefox production build

# Development with watch mode
npm run dev:chrome          # Watch mode for Chrome
npm run dev:firefox         # Watch mode for Firefox

# Testing
npm test                    # Run Vitest tests
npm run test:watch          # Watch mode
npm run test:ui             # Interactive test UI
npm run test:coverage       # Coverage report

# Other
npm run typecheck           # TypeScript type checking
npm run clean               # Remove dist folder
```

### Rust Service (jreader-rs/jreader-service)
```bash
# Build and run the Axum service
cargo run --bin jreader-service-server

# The service listens on port 3001 and provides:
# - Dictionary lookups via Axum rust server
# - EPUB parsing and text extraction
# - Morphological analysis (MeCab/Vibrato)
```

## Architecture

### Frontend Architecture

**Tech Stack**: Next.js 15 (App Router), React 19 RC, TypeScript, Tailwind CSS, Supabase (auth + database)

**Key Directories**:
- `app/`: Next.js app router pages and API routes
  - `landing/`: Landing page (exported as homepage `/`)
  - `dashboard/`: User dashboard with stats overview (formerly `/welcome`)
  - `library/`: Book library and reader interface
  - `mining/`: Mining history page (Anki card management)
  - `dictionary/`: Standalone dictionary lookup page (public access)
  - `stats/`: User statistics with activity heatmap and progress charts
  - `api/`: API endpoints (webhooks, auth, upload, etc.)
- `components/`: React components (UI primitives, compound components)
- `contexts/`: React contexts (Auth, Settings, KanjiMode, etc.)
- `hooks/`: Custom React hooks
- `utils/`: Utility functions and helpers
  - `supabase/`: Supabase client/server utilities
  - `ankiconnect/`: AnkiConnect integration logic
- `services/`: Service layer (backendService.ts for Rust HTTP API communication)

**Authentication Flow**:
- Uses Supabase Auth with Discord OAuth
- `AuthContext` provides user state and admin status
- Middleware (`middleware.ts`) handles session management
- Admin status cached and checked via `/api/check-admin`
- **Public access**: Dictionary and reading features work without authentication (graceful degradation for mining/audio)

**Reader Flow** (`/library/[supabase_upload_id]`):
- Dual-pane layout: TextPane (book content) + SearchPane (dictionary lookups)
- Mobile uses drawer for SearchPane
- Dictionary lookups via REST API to Rust service (port 3001)
- Kanji highlighting and state tracking (known/encountered/unknown)
- Bookmark management via localStorage and Supabase
- Page navigation with URL state management

**Mining System**:
- `/mining` page shows user's mined cards from Supabase `cards` table
- Supports bulk Anki sync via browser extension
- Card editing with inline SearchPane
- Sync status tracking (local_only, pending, synced)
- Merged expression/reading columns with furigana display
- Responsive mobile view with improved layout

**Stats and Dashboard**:
- `/dashboard`: User dashboard with overview and quick stats
- `/stats`: Detailed statistics page with activity heatmap and progress charts
- Activity tracking for reading and mining habits

**Data Flow**:
- Frontend → Rust Axum HTTP Service (dictionary lookups, text processing)
- Frontend ↔ Supabase (auth, user data, uploads, cards)
- Frontend ↔ Extension (via postMessage for Anki sync)
- Extension → AnkiConnect (localhost:8765)

### Extension Architecture

**Tech Stack**: TypeScript, esbuild, React 19, Supabase client, Vitest

**Key Files**:
- `src/sw-main.ts`: Service worker (MV3 background script)
- `src/content.ts`: Content script for web page integration
- `src/popup.tsx`: Extension popup UI
- `src/settings.tsx`: Extension settings page
- `src/lib/extensionAuth.ts`: Centralized Supabase auth for extension
- `build.mjs`: Custom esbuild build script

**Build System**:
- Supports Chrome and Firefox with separate manifests
- Environment-specific builds (dev/prod) with different configurations
- Each build outputs to a separate directory: `dist-{target}-{env}` (e.g., `dist-chrome-dev`, `dist-firefox-prod`)
- Icons auto-generated from SVG via `scripts/generate-icons.js`
- Build validation checks manifests and enforces target/env specification

**Extension ↔ Web Communication**:
- Content script validates message origins
- Handles `extensionCheck`, Anki sync requests
- **Chrome**: Uses Chrome identity API for OAuth flow
- **Firefox**: Uses Port keep-alive pattern for OAuth flow
- Session stored in extension storage
- Improved connection handling with graceful degradation

### Rust Service Architecture

**Tech Stack**: Rust, Axum (HTTP), Vibrato (morphological analysis), Supabase via tokio-postgres

**Key Files**:
- `main.rs`: Server setup, routing, middleware
- `http_handlers.rs`: HTTP endpoints (upload, download, signed URLs)
- `dictionaries.rs`: Dictionary lookup and term processing
- `auth.rs`: JWT verification for Supabase auth
- `mecab.rs`: Japanese text segmentation
- `xml.rs`: EPUB OPF parsing for title, author, cover

**Services**:
- HTTP service on port 3001 (term lookups, EPUB parsing, file uploads and media proxying)
- Dictionary data stored in local SQLite databases

### epub-metadata (separate repo)

EPUB metadata extraction is handled by a **separate binary** (`epub-metadata`) in its own repository.

- **Repository**: Clone from the epub-metadata repo (not part of this workspace)
- **Build**: `cargo build --release` in the epub-metadata repo
- **Usage**: `epub-metadata <epub-path>` outputs JSON to stdout with `total_pages`, `toc`, and `spine`
- **Configuration**: Set `EPUB_METADATA_BIN` env var in jreader-rs `.env` to point to the built binary
- **Default**: Falls back to `epub-metadata` on `PATH` if env var is not set

## Important Patterns

### Safe Browser APIs
Always use the safe wrappers in `utils/safeStorage.ts` and `utils/safeWindow.ts`:
```typescript
// Instead of localStorage.setItem/getItem
safeNumberStorage.setItem('key', value)
safeJsonStorage.getItem('key', defaultValue)
safeBooleanStorage.getItem('key', false)

// Instead of window.location, document.title
safeLocation.setHref('/path')
safeDocument.setTitle('Title')
safeHistory.pushState({}, '', url)
```

### Supabase Client Usage
```typescript
// Client-side (in components)
import { createClient } from '@/utils/supabase/client'
const supabase = createClient()

// Server-side (in API routes)
import { createClient } from '@/utils/supabase/server'
const supabase = await createClient()
```

### Backend Service Communication
```typescript
import { backendService } from '@/services/backendService'
const result = await backendService.lookupTerm(text, position)
```

### Extension Communication
Frontend posts messages to content script:
```typescript
window.postMessage({
  type: EXTENSION_CONTENT_SCRIPT_EVENT_TYPE,
  data: payload
}, window.location.origin)
```

Content script forwards to service worker via `chrome.runtime.sendMessage`.

## Database Schema

**Supabase Tables** (key tables):
- `Users`: User accounts with `tier` (0=free, 1=pro, 2=unlimited)
- `User Uploads`: EPUB/book uploads
- `User Preferences`: Dictionary order, disabled/spoiler dicts, kanji highlighting settings
- `cards`: Mining cards with Anki sync status
- `Table of Contents`: Book TOC entries
- `kanji_state`: Kanji learning states (known/encountered)
- `Dictionary Index`: Available dictionaries metadata
- `webnovel`: Webnovel metadata from Syosetu imports

## Stripe Integration

JReader uses Stripe for subscriptions (Pro and Unlimited tiers).

**Environment Variables Required**:
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- Product/Price IDs for tiers

**Webhook Handler**: `/api/webhooks/stripe`
- Handles subscription created/updated/deleted events
- Updates `Users` table with tier and Stripe IDs

See `jreader-frontend/STRIPE_SETUP.md` for full setup instructions.

## Local Development Setup

1. **Frontend**: Create `.env.local` in `jreader-frontend/` with Supabase keys, Stripe keys
2. **Extension**: Create `.env.local` in `jreader-extension/` with Supabase keys
3. **Rust Service**: Create `.env` in `jreader-rs/` with database URLs and Supabase config
4. **epub-metadata**: Clone the epub-metadata repo, run `cargo build --release`, and set `EPUB_METADATA_BIN` in `jreader-rs/.env` to point to the built binary (e.g. `/path/to/epub-metadata/target/release/epub-metadata`)
5. **syosetu2epub**: Lives in a separate repo (`waiwai-tmw/syosetu2epub-jreader`). Clone it and set `SYOSETU2EPUB_DIR` in `jreader-rs/.env` to point to the checkout (e.g. `/Users/you/code-waiwai/syosetu2epub`).

**Running Services**:
```bash
# Terminal 1: Rust service
cd jreader-rs/jreader-service
cargo run --bin jreader-service-server

# Terminal 2: Frontend (dev server on port 3000, uses .next-dev)
cd jreader-frontend
npm run dev

# Terminal 3: Extension (optional)
cd jreader-extension
npm run dev:chrome

# Optional: Run production build + server alongside dev (uses .next-prod, doesn't interfere with dev)
cd jreader-frontend
npm run build
npm start  # Starts on port 3001 (or use -p 3001 to specify port)
```

**Running E2E Tests**:
```bash
# Terminal 1: Rust service (required)
cd jreader-rs/jreader-service
cargo run --bin jreader-service-server

# Terminal 2: Run e2e tests (automatically starts prod server)
cd jreader-frontend
npm run test:e2e
```

**For Stripe webhooks locally**:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

**For Tailscale serving** (see README.md):
```bash
tailscale serve --bg 3000
tailscale serve --bg --set-path=/jreader-service 3001
```

## Render Deployment (npm workspaces)

The monorepo uses npm workspaces to share types between frontend and extension.

**Render Settings** (same as before):
- **Root Directory**: `jreader-frontend/`
- **Build Command**: `yarn; yarn build` (or `npm install && npm run build`)
- **Start Command**: `yarn start` (or `npm start`)

**How it works**:
1. When `yarn` (or `npm install`) runs in `jreader-frontend/`, the `predev`/`prebuild` hooks trigger
2. These hooks cd to the repo root and run `npm install --workspaces --legacy-peer-deps`
3. This links all workspaces (frontend, extension, shared-types) into node_modules
4. Then they build the shared types package
5. Next.js build runs and can resolve `@jreader/shared-types-ts/extensionAvailability` correctly

**Why this works**:
- The shared types package has `"prepare": "npm run build"` and `"files": ["dist"]` to ensure dist/ exists
- Frontend depends on `@jreader/shared-types-ts@1.0.0` which resolves to the local workspace (not npm registry)
- `--legacy-peer-deps` handles React 19 RC peer dependency conflicts with `@hello-pangea/dnd`
- Next.js config includes `transpilePackages: ['@jreader/shared-types-ts']`

## Git Workflow

- Main branch: `main`
- Feature branches: `waiwai/jre-XXX-description`
- Always commit with descriptive messages ending with:
  ```
  🤖 Generated with [Claude Code](https://claude.com/claude-code)

  Co-Authored-By: Claude <noreply@anthropic.com>
  ```

## Testing Philosophy

- Frontend: Jest with React Testing Library
- Extension: Vitest with jsdom
- Test files colocated with source or in `__tests__` directories
- Mock external services (Supabase, Axum) in tests

## Build Cache Architecture

The frontend uses **separate .next directories for dev and production** to prevent cache collisions:

- **`next dev`** → builds to `.next-dev` (development server)
- **`next build`** → builds to `.next-prod` (production build)
- **`next start`** → reads from `.next-prod` (production server)
- **`npm run test:e2e`** → uses `.next-prod` (Playwright e2e tests)

This allows running dev and production builds **simultaneously without cache conflicts**. The phase-based configuration in `next.config.js` automatically selects the correct directory based on the Next.js phase.

**Important**: Don't manually delete `.next` directories—the build system uses phase-aware paths. If you need to reset caches:
```bash
rm -rf .next-dev   # Clear dev cache only
rm -rf .next-prod  # Clear prod cache only
```

## Common Gotchas

1. **Extension builds require explicit target and environment**: Don't run `npm run build` alone in extension directory
2. **Frontend build cache**: Dev and prod builds use separate `.next` directories (`.next-dev` and `.next-prod`) to prevent interference
3. **Supabase sessions**: Web app and extension maintain separate sessions (different storage scopes)
4. **Axum port**: Rust service must run on port 3001 for frontend to connect
5. **Dictionary data**: Dictionary SQLite files must be present in `jreader-rs/jreader-service/data/dicts/db/`
6. **Kanji highlighting**: Settings stored in `User Preferences` table and cached in localStorage
7. **Shared types build**: The `jreader-shared-types-ts` workspace must build before the frontend (handled by `predev` and `prebuild` hooks)

## Extension-Specific Notes

- Content script only runs on allowed origins (localhost, production domain)
- Service worker handles Supabase auth and AnkiConnect communication
- Popup and settings pages share theme state via Chrome storage events
- AnkiConnect must be running (Anki with AnkiConnect addon) for sync features
- Extension pairing flow: User signs in via Discord OAuth, extension stores session
