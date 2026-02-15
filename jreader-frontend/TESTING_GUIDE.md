# Testing the SQLite Migration

## 🎯 Quick Start

### 1. **View the Database with Drizzle Studio**

Drizzle Studio is a GUI for browsing and editing your SQLite database.

```bash
npm run db:studio
```

This will open a browser at `https://local.drizzle.studio` where you can:
- Browse all tables
- View data
- Add/edit/delete records
- Run queries

**Note**: Drizzle Studio runs on port 4983 by default.

### 2. **Create a Test User**

You have two options:

**Option A: Via the web app**
1. Start the dev server: `npm run dev`
2. Go to http://localhost:3000/login
3. Enter a username (e.g., "testuser")
4. Click Login

The system will automatically create a user in the database.

**Option B: Directly in Drizzle Studio**
1. Open Drizzle Studio: `npm run db:studio`
2. Go to the `users` table
3. Click "Add Row"
4. Fill in:
   - `id`: Any unique string (e.g., "user-1")
   - `username`: Your test username (e.g., "testuser")
   - `tier`: 0 (free), 1 (pro), or 2 (unlimited)
   - `created_at`: Current ISO timestamp (e.g., "2026-02-08T12:00:00.000Z")
5. Save

### 3. **Set Your Admin Username**

Create or update your `.env.local`:

```bash
# Copy from example if you haven't
cp .env.local.example .env.local
```

Edit `.env.local` and set:
```env
ADMIN_USERNAME=testuser
```

This gives your test user admin access.

### 4. **Seed Test Data**

You can add test data through Drizzle Studio:

**Books** (`user_uploads` table):
```
id: "book-1"
user_id: "user-1"  (or your user id)
directory_name: "test-book"
title: "Test Book"
author: "Test Author"
total_pages: 100
cover_path: null
created_at: "2026-02-08T12:00:00.000Z"
```

**Preferences** (`user_preferences` table):
```
user_id: "user-1"
term_order: "JMdict (English)#2024-12-05,..." (comma-separated dict list)
term_disabled: "" (empty or comma-separated)
term_spoiler: ""
freq_order: "JPDB Frequency#2024-01-01,..."
freq_disabled: ""
should_highlight_kanji_in_search: 1 (true)
should_highlight_kanji_in_text: 1 (true)
```

**Cards** (`cards` table):
```
id: 1
user_id: "user-1"
expression: "日本語"
reading: "にほんご"
definitions: [{"type": "meaning", "content": "Japanese language"}]
sentence: "日本語を勉強しています。"
pitch_accent: null
frequency: null
sync_status: "local_only"
created_at: "2026-02-08T12:00:00.000Z"
updated_at: "2026-02-08T12:00:00.000Z"
```

**Kanji States** (`kanji_state` table):
```
user_id: "user-1"
kanji: "日"
state: 1 (1=known, 0=encountered)
is_import: 0 (false)
```

## 🧪 Testing Checklist

### Authentication
- [ ] Login with username-only works
- [ ] Cookie is set after login
- [ ] localStorage contains username
- [ ] Middleware redirects unauthenticated users from `/settings`, `/stats`
- [ ] Admin check works at `/api/check-admin`

### Library Page
- [ ] Books display after login
- [ ] Book covers show from `/api/files/uploads/...`
- [ ] Can click on a book (may not fully work yet - book content loading pending)
- [ ] Book count shows correctly

### Settings Page
- [ ] Dictionary order loads
- [ ] Can drag-and-drop dictionaries
- [ ] Settings save successfully
- [ ] Kanji highlighting toggles work

### Mining Page
- [ ] Cards display in table/card view
- [ ] Sorting works (created, updated, sync status)
- [ ] Pagination works
- [ ] "Show only needing update" filter works
- [ ] Can click edit on a card
- [ ] Card editor opens with SearchPane
- [ ] Can save edited card

### Stats Page
- [ ] Kanji counts display
- [ ] Can import kanji from text
- [ ] Activity heatmap shows
- [ ] Graphs render

## 🔍 Debugging

### Check Database Directly

Use SQLite CLI:
```bash
sqlite3 data/jreader.db

# Inside sqlite3:
.tables                          # List all tables
.schema users                    # View table schema
SELECT * FROM users;             # Query users
SELECT * FROM user_uploads;      # Query books
SELECT * FROM cards;             # Query cards
.quit                            # Exit
```

### Check API Responses

Use curl or browser DevTools:
```bash
# Get books (must have cookie)
curl http://localhost:3000/api/books \
  -H "Cookie: jreader_username=testuser"

# Get preferences
curl http://localhost:3000/api/preferences \
  -H "Cookie: jreader_username=testuser"

# Get cards
curl "http://localhost:3000/api/cards?sortBy=created_at&sortDirection=desc&page=1&limit=10" \
  -H "Cookie: jreader_username=testuser"

# Get dictionaries (no auth needed)
curl http://localhost:3000/api/dictionaries
```

### Check Server Logs

Watch the dev server output for:
- SQL query errors from Drizzle
- API route errors
- Missing environment variables

### Common Issues

**"Not authenticated" errors**:
- Check if cookie is set: Open DevTools → Application → Cookies
- Verify username in localStorage: `localStorage.getItem('jreader_username')`
- Make sure you logged in first

**"No such table" errors**:
- Run migrations: The DB should auto-initialize when you first import from `db/index.ts`
- Check if `data/jreader.db` exists
- Verify schema in `db/schema.ts`

**Empty data**:
- Add test data via Drizzle Studio
- Or use the app to create data (login, change settings, etc.)

**Dictionary data missing**:
- The `dictionary_index` table should be populated
- Check if you have dictionary files in your Rust backend

## 🚀 Full Testing Flow

1. **Start everything**:
   ```bash
   # Terminal 1: Dev server
   npm run dev

   # Terminal 2: Drizzle Studio (optional)
   npm run db:studio
   ```

2. **Create test user**:
   - Go to http://localhost:3000/login
   - Enter username "testuser"
   - Login

3. **Add test data** (via Drizzle Studio or manually):
   - Add a book to `user_uploads`
   - Add preferences to `user_preferences`
   - Add a card to `cards`
   - Add some kanji to `kanji_state`

4. **Test each page**:
   - Library: http://localhost:3000/library
   - Settings: http://localhost:3000/settings
   - Mining: http://localhost:3000/mining
   - Stats: http://localhost:3000/stats

5. **Try key features**:
   - Change dictionary order in settings
   - Edit a mining card
   - Import kanji in stats page
   - View book in library

## 📝 Notes

- The database is at `./data/jreader.db` (SQLite file)
- Migrations are in `./db/migrations/`
- Schema is defined in `./db/schema.ts`
- All API routes now use cookies for auth (no bearer tokens)
- File serving is through `/api/files/[...path]` (no signed URLs)

## 🔧 Database Maintenance

**Reset database**:
```bash
rm data/jreader.db
# Restart dev server to recreate
```

**Apply schema changes**:
```bash
npm run db:generate  # Generate migration from schema changes
npm run db:push      # Push changes directly (dev only)
```

**Backup database**:
```bash
cp data/jreader.db data/jreader.db.backup
```
