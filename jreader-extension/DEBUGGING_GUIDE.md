# Extension Debugging Guide

This guide helps you interpret the comprehensive logging added to the JReader extension for troubleshooting.

## Log Categories & Emojis

### 🚀 Background Script
- **🚀 JReader Extension background script loaded** - Background script initialization
- **🌐 Browser:** - Browser detection result
- **📊 Background script environment** - API availability check
- **📦 JReader Extension installed/updated** - Extension lifecycle events
- **🔄 Extension startup** - Service worker startup
- **🔍 Service worker startup** - Session restoration
- **📨 Message received** - Incoming messages from content scripts/popup
- **🔐 AUTH_CHANGED** (`popup.auth.changed`, constant `POPUP_EVENT_AUTH_CHANGED`) - Auth state change broadcast from `extensionAuth`
- **🔄 Processing SYNC_CARD** - Card sync operations
- **📤 SYNC_CARD result** - Sync operation results

### 🌐 Content Script
- **🌐 JReader Extension content script loaded** - Content script initialization
- **🔍 Browser info** - Browser detection
- **📊 Content script environment** - Runtime availability
- **📨 Message received from web app** - Web app communication
- **🚫 Rejected message from unauthorized origin** - Security rejections
// Legacy pairing logs removed
- **🔍 Processing extension check** - Availability checks
- **🔄 Processing sync card request** - Card sync requests
- **📤 Sending SYNC_CARD message** - Background communication
- **📨 Received SYNC_CARD response** - Background responses

### 🎨 Popup Script
- **🎨 JReader Extension popup loaded** - Popup initialization
- **🔍 Browser info** - Browser detection
- **📊 Popup environment** - API availability
- **🔍 Checking authentication** - Authentication status via `extensionAuth`
- **💾 Session check result** - Storage checks
- **🔄 Starting sync to Anki** - Sync operations
- **⚙️ Anki settings found** - Configuration checks
- **📤 Sending SYNC_TO_ANKI message** - Background communication
- **📨 Received SYNC_TO_ANKI response** - Background responses

### 🔧 Browser API
- **🔧 Browser API initialized** - Polyfill initialization
- **📊 Browser API availability** - Cross-browser compatibility

## Common Debugging Scenarios

### 1. Extension Not Loading
**Look for:**
```
🚀 JReader Extension background script loaded
🌐 Browser: chrome/firefox/edge
📊 Background script environment: { hasBrowser: true, hasRuntime: true }
```

**If missing:** Extension not installed or disabled

### 2. Content Script Not Working
**Look for:**
```
🌐 JReader Extension content script loaded
📊 Content script environment: { hasBrowser: true, hasRuntime: true }
```

**If missing:** Content script not injected or page blocked

### 3. Web App Communication Issues
**Look for:**
```
📨 Message received from web app: { origin: "https://...", type: "syncCard" }
🔍 Processing sync card request: { hasCardData: true, cardId: "..." }
📤 Sending SYNC_CARD message to background script
```

**If missing:** Web app not sending messages or origin blocked

### 4. Background Script Communication
**Look for:**
```
📨 Message received: { type: "SYNC_CARD", sender: { tab: 123 } }
🔄 Processing SYNC_CARD request: { cardId: "...", hasCardData: true }
📤 SYNC_CARD result: { success: true, ankiNoteId: "..." }
```

**If missing:** Background script not receiving messages

### 5. Supabase Session Issues
**Look for:**
```
🔐 AUTH_CHANGED: SIGNED_IN (message type `popup.auth.changed`)
🔧 Hydrating auth via extensionAuth
✅ Session restored
```

**If missing:** OAuth or storage issue

### 6. Anki Sync Issues
**Look for:**
```
🔄 Starting sync to Anki...
⚙️ Anki settings found: { hasConnectUrl: true, hasDeck: true }
📤 Sending SYNC_TO_ANKI message to background script
📨 Received SYNC_TO_ANKI response: { success: true, syncedCount: 1 }
```

**If missing:** Anki configuration or connection issues

## Error Patterns

### ❌ Common Errors
- **❌ No existing Supabase session found** - Normal for new users
- **❌ Invalid or missing nonce** - Authentication flow issue
- **❌ Browser runtime not available** - Extension not loaded
- **💥 Error syncing to Anki** - Anki Connect issues

### 🔧 Troubleshooting Steps
- **🔧 Troubleshooting steps: 1) Refresh page, 2) Check extension enabled** - Runtime issues
- **🔧 Initializing Supabase with session** - Session setup
- **🔧 Troubleshooting steps** - General guidance

## Browser Console Locations

### Chrome/Edge
1. **Background Script**: `chrome://extensions/` → JReader Extension → "Inspect views: background page"
2. **Content Script**: Right-click page → "Inspect" → Console tab
3. **Popup**: Right-click extension icon → "Inspect popup"

### Firefox
1. **Background Script**: `about:debugging` → "This Firefox" → JReader Extension → "Inspect"
2. **Content Script**: Right-click page → "Inspect Element" → Console tab
3. **Popup**: Right-click extension icon → "Inspect"

## Log Filtering

### Filter by Component
- **Background**: Filter for `🚀`, `📦`, `🔄`, `📨`, `🔑`
- **Content**: Filter for `🌐`, `📨`, `🔍`, `🔄`
- **Popup**: Filter for `🎨`, `🔍`, `💾`, `🔄`

### Filter by Operation
- **Sync**: Filter for `🔄`, `📤`, `📨`
- **Auth**: Filter for `🔑`, `💾`
- **Init**: Filter for `🚀`, `🌐`, `🎨`, `🔧`

## Performance Monitoring

### Key Metrics to Watch
- **Message round-trip time**: Time between `📤 Sending` and `📨 Received`
- **Session initialization**: Time for Supabase setup
- **Sync operations**: Time for Anki operations
- **Storage operations**: Time for local storage access

### Red Flags
- **Missing timestamps**: Indicates logging issues
- **Long delays between messages**: Performance problems
- **Repeated errors**: Persistent issues
- **Missing expected logs**: Broken flow

## Quick Debug Checklist

1. **Extension Loading**: Look for `🚀` and `🌐` logs
2. **API Availability**: Check `📊` environment logs
3. **Web App Communication**: Look for `📨 Message received from web app`
4. **Background Communication**: Check `📨 Message received` in background
5. **Auth Events**: Look for `🔐 AUTH_CHANGED` (`popup.auth.changed`)
6. **Sync Operations**: Check `🔄 Processing` and `📤 SYNC_CARD result`

## Log Levels

- **Info** (🔍, 📊, 🔧): Normal operation
- **Success** (✅, 📤, 📨): Successful operations
- **Warning** (⚠️, 🚫): Non-critical issues
- **Error** (❌, 💥): Critical failures

Use this guide to quickly identify where issues occur in the extension flow and take appropriate action.
