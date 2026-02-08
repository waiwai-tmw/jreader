# Safe Storage and Window Utilities

This directory contains utilities for safely handling browser APIs in Next.js applications with SSR support.

## Files

- `safeStorage.ts` - Safe localStorage utilities
- `safeWindow.ts` - Safe window API utilities  
- `useSafeStorage.ts` - React hooks for safe storage

## Usage Examples

### Safe Storage

```typescript
import { safeStorage, safeNumberStorage, safeBooleanStorage } from '@/utils/safeStorage';

// Basic storage
safeStorage.setItem('user-preference', 'dark-mode');
const theme = safeStorage.getItem('user-preference'); // 'dark-mode' or null

// Number storage
safeNumberStorage.setItem('font-size', 16);
const fontSize = safeNumberStorage.getItem('font-size', 14); // 16 or 14 (default)

// Boolean storage
safeBooleanStorage.setItem('sidebar-open', true);
const isOpen = safeBooleanStorage.getItem('sidebar-open', false); // true or false (default)
```

### Safe Window APIs

```typescript
import { safeLocation, safeHistory, safeDocument } from '@/utils/safeWindow';

// Location
const pathname = safeLocation.pathname; // '/current/path' or ''
safeLocation.navigate('/new-page');

// History
safeHistory.pushState({}, '', '/new-url');
safeHistory.replaceState({}, '', '/updated-url');

// Document
safeDocument.setTitle('New Page Title');
const title = safeDocument.getTitle(); // 'New Page Title' or ''
```

### React Hooks

```typescript
import { useSafeNumberStorage, useSafeBooleanStorage } from '@/hooks/useSafeStorage';

function MyComponent() {
  const [fontSize, setFontSize, isLoaded] = useSafeNumberStorage('font-size', 16);
  const [isDarkMode, setIsDarkMode] = useSafeBooleanStorage('dark-mode', false);

  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <button onClick={() => setFontSize(fontSize + 1)}>
        Increase Font Size ({fontSize})
      </button>
      <button onClick={() => setIsDarkMode(!isDarkMode)}>
        Toggle Dark Mode ({isDarkMode ? 'On' : 'Off'})
      </button>
    </div>
  );
}
```

## Benefits

1. **SSR Safe**: All utilities check for `window` availability before accessing browser APIs
2. **Error Handling**: Built-in try-catch blocks with console warnings
3. **Type Safety**: Full TypeScript support with proper types
4. **Default Values**: Utilities return sensible defaults when localStorage is unavailable
5. **React Integration**: Hooks provide seamless integration with React components

## Migration from Direct API Usage

### Before (SSR Unsafe)
```typescript
// ❌ This will cause SSR errors
const fontSize = localStorage.getItem('font-size');
window.location.href = '/new-page';
document.title = 'New Title';
```

### After (SSR Safe)
```typescript
// ✅ This is SSR safe
const fontSize = safeNumberStorage.getItem('font-size', 16);
safeLocation.navigate('/new-page');
safeDocument.setTitle('New Title');
```

## Best Practices

1. **Always use these utilities** instead of direct browser API access
2. **Provide default values** for all storage operations
3. **Use React hooks** for component state that needs to persist
4. **Handle loading states** when using the hooks
5. **Test in both SSR and client environments**

## API Reference

### safeStorage
- `getItem(key: string): string | null`
- `setItem(key: string, value: string): void`
- `removeItem(key: string): void`
- `clear(): void`
- `length: number`
- `key(index: number): string | null`

### safeNumberStorage
- `getItem(key: string, defaultValue: number): number`
- `setItem(key: string, value: number): void`
- `removeItem(key: string): void`

### safeBooleanStorage
- `getItem(key: string, defaultValue: boolean): boolean`
- `setItem(key: string, value: boolean): void`
- `removeItem(key: string): void`

### safeLocation
- `pathname: string`
- `search: string`
- `href: string`
- `navigate(url: string): void`
- `reload(): void`

### safeHistory
- `pushState(state: any, title: string, url?: string): void`
- `replaceState(state: any, title: string, url?: string): void`
- `back(): void`
- `forward(): void`

### safeDocument
- `setTitle(title: string): void`
- `getTitle(): string`
- `addEventListener(type: string, listener: EventListener): void`
- `removeEventListener(type: string, listener: EventListener): void`
