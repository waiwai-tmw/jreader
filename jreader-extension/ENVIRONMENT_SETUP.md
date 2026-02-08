# Environment Setup

This extension supports both build-time and runtime configuration for Supabase and related settings. Follow these steps to set up your environment:

## 1. Create Environment File (optional)

Create a `.env.local` file in the extension root directory with your Supabase credentials. This is read during the build by `build.mjs` and inlined:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

### How to get these values:

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Copy the **Project URL** (this is your `SUPABASE_URL`)
5. Copy the **anon public** key (this is your `SUPABASE_ANON_KEY`)

## 2. Configure Supabase Redirect URLs

In your Supabase project:

1. Go to **Authentication** → **URL Configuration**
2. Add your extension's redirect URL to **Redirect URLs**.
   - Chrome (using `chrome.identity`): `https://<YOUR_EXTENSION_ID>.chromiumapp.org/auth-callback`
   - Firefox (AMO temporary): `moz-extension://<generated-id>/auth-callback.html` (only if you implement a page-based callback)

   To find your Chrome extension ID:
   - Load the extension in Chrome Developer Mode
   - Go to `chrome://extensions/`
   - Find your extension and copy the ID

## 3. Runtime Configuration (Settings page)

You can also set the following at runtime via the extension's settings page (stored in extension storage and used by the service worker):

- `supabase_url`
- `supabase_anon_key`
- `api_base_url` (server used for Anki plan building)
- `anki_connect_url`, `anki_deck`, `anki_note_type`

The service worker reads these from `browser.storage.local`.

## 4. Build the Extension

After setting up your environment variables, build the extension:

```bash
# Choose one target
npm run build:chrome
# or
npm run build:firefox
```

The build process will automatically load your `.env.local` variables and embed them. Runtime settings from the options page override build-time values where applicable.

## Security Notes

- `.env.local` is already added to `.gitignore` to prevent committing sensitive credentials
- Environment variables are embedded at build time, not at runtime
- Never commit your actual Supabase credentials to version control

## Troubleshooting

If you see "Supabase configuration missing" in the console:

1. Verify your `.env.local` file exists and has the correct format
2. Check that your Supabase URL and key are correct
3. Rebuild the extension after making changes to `.env.local`
4. Check the build output for environment variable loading status
