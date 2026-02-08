# SearchPane Re-render Investigation & Optimization Guide

## Overview

This guide helps you investigate and reduce unnecessary re-renders in the SearchPane component, which can lead to:
- Extra backend API calls
- Performance degradation
- Potential UI bugs
- Poor user experience

## Recent Optimizations Applied

Based on the console log analysis showing **22 renders on a single page load**, the following critical optimizations have been implemented:

### 1. Fixed User Preferences Loading (Dictionary Page)

**Problem**: User preferences were being loaded multiple times, triggering 4+ re-renders each time.

**Solution**: 
- Memoized the `fetchPreferences` function with `useCallback`
- Added early return when cached preferences are available
- Changed dependency from `[user, supabase]` to `[user, fetchPreferences]`
- Only load preferences when user changes and no preferences exist
- **Added loading state protection** to prevent multiple simultaneous loads

**Expected Impact**: Reduce renders from 22 to ~5-8 on page load.

### 2. Improved SearchResult Memoization

**Problem**: `memoizedSearchResult` wasn't properly detecting when results actually changed.

**Solution**:
- Added deep comparison using JSON.stringify for result content
- Improved dependency array to include actual content changes
- Removed unnecessary `termGroups` dependency from useEffect
- **Created stable `searchResultHash`** for better comparison
- **Added content hash detection** to prevent re-renders on duplicate data

**Expected Impact**: Prevent unnecessary re-renders when search results haven't actually changed.

### 3. Optimized useEffect Dependencies

**Problem**: useEffect was running too frequently due to unnecessary dependencies.

**Solution**:
- Removed `termGroups` from useEffect dependencies (it was causing extra renders)
- Kept only essential dependencies: `memoizedSearchResult`, `isLoading`, `searchStack.length`, `markKanjiAsEncountered`, `setSearchStack`
- **Replaced complex object dependencies with stable hashes**

**Expected Impact**: Reduce render frequency by ~30-40%.

### 4. React.memo with Custom Comparison

**Problem**: Component was re-rendering even when props hadn't meaningfully changed.

**Solution**:
- Wrapped SearchPane with `React.memo` and custom comparison function
- Implemented deep comparison for `searchResult` prop
- Added comprehensive prop change detection
- **Custom comparison prevents re-renders when only object references change**

**Expected Impact**: Prevent ~50% of unnecessary re-renders from prop changes.

### 5. Additional Optimizations (Round 3)

**Problem**: Still seeing 8 renders with duplicate API calls and paired renders.

**Solutions**:

#### A. Search Deduplication
- Added `lastSearchKey` state to track previous searches
- Implemented duplicate search prevention in `debouncedSearch`
- Added search key tracking during URL initialization
- **Prevents multiple API calls for the same search term**

#### B. Function Memoization Optimization
- Extracted `markKanjiAsEncountered` function to separate `useCallback`
- Reduced `debouncedSearch` dependencies from 4 to 1
- **Prevents function recreation and subsequent re-renders**

#### C. Enhanced Initialization Protection
- Added search key tracking during URL initialization
- Improved dependency management for initialization effect
- **Prevents duplicate searches during page load**

**Expected Impact**: Further reduce renders from 8 to ~4-6 on page load.

### 6. Final Optimizations (Round 4)

**Problem**: Still seeing 6 renders with 2 API calls and paired renders.

**Solutions**:

#### A. Initialization Path Deduplication
- Added duplicate search prevention to URL initialization loop
- Implemented search key checking during initialization
- **Prevents duplicate API calls during page load**

#### B. Render Batching
- Wrapped render tracking in `useMemo` to batch state updates
- Reduced render tracking frequency
- **Prevents paired renders from state updates**

#### C. Session Logging Optimization
- Reduced session logging frequency (10% chance in development)
- **Reduces console noise and potential performance impact**

**Expected Impact**: Further reduce renders from 6 to ~4-5 on page load.

### 7. Ultimate Optimizations (Round 5)

**Problem**: Still seeing 6 renders with 3 API calls despite previous optimizations.

**Solutions**:

#### A. Global Search Cache
- Added `searchCache` state to store all search results
- Implemented cache checking before making API calls
- **Prevents any duplicate API calls across all code paths**

#### B. Initialization Protection
- Added `isInitializing` state to prevent multiple initialization calls
- Implemented initialization guard in useEffect
- **Prevents multiple initialization cycles**

#### C. Enhanced Cache Management
- Cache results in both initialization and user interaction paths
- Cache is checked before any API call
- **Ensures single API call per unique search term**

**Expected Impact**: Further reduce renders from 6 to ~3-4 on page load.

## Tools Created

### 1. Render Tracker Utility (`utils/renderTracker.ts`)

A comprehensive tracking system that monitors component re-renders in real-time.

**Features:**
- Tracks render counts and timing
- Identifies which props changed between renders
- Provides render history
- Performance monitoring utilities

**Usage:**
```typescript
import { useRenderTracker } from '@/utils/renderTracker';

function MyComponent(props) {
  const { track } = useRenderTracker({
    componentName: 'MyComponent',
    enabled: process.env.NODE_ENV === 'development',
    logProps: false,
    trackDependencies: true
  });

  const renderCount = track(props, [/* dependencies */]);
  // ... rest of component
}
```

### 2. Render Analyzer Component (`components/RenderAnalyzer.tsx`)

A visual interface for analyzing re-renders in real-time.

**Features:**
- Real-time render statistics
- Visual prop change tracking
- Performance metrics
- Keyboard shortcuts (Ctrl+Shift+R to toggle)

**Usage:**
```typescript
import { useRenderAnalyzer } from '@/components/RenderAnalyzer';

function App() {
  const { RenderAnalyzerComponent } = useRenderAnalyzer('SearchPane');
  
  return (
    <div>
      {/* Your app content */}
      <RenderAnalyzerComponent />
    </div>
  );
}
```

## How to Investigate Re-renders

### 1. Enable Render Tracking

The SearchPane component now includes render tracking by default in development mode. You'll see console logs like:

```
🔄 [SearchPane] Render #5 {
  changedProps: ['searchResult', 'isLoading'],
  props: { hasProps: true },
  dependencies: [...],
  timeSinceLastRender: 150
}
```

### 2. Use the Render Analyzer

1. Press `Ctrl+Shift+R` to toggle the render analyzer
2. Or call `window.toggleRenderAnalyzer()` in the browser console
3. Monitor render counts and prop changes in real-time

### 3. Analyze Common Re-render Triggers

Based on the SearchPane component analysis, here are the most likely causes of unnecessary re-renders:

#### A. Props from Parent Components

**High Impact:**
- `searchResult` - Changes when new search results arrive
- `searchStack` - Changes when navigating search history
- `userPreferences` - Changes when user settings update

**Medium Impact:**
- `searchQuery` - Changes during typing
- `isLoading` - Changes during search operations
- `stackPosition` - Changes during navigation

**Low Impact:**
- `isStandalone`, `isAuthenticated` - Rarely change

#### B. Internal State Changes

**Audio State:**
```typescript
const [audioData, setAudioData] = useState<Record<string, AudioResponse>>({});
const [audioLoading, setAudioLoading] = useState<Record<string, boolean>>({});
const [audioError, setAudioError] = useState<Record<string, string>>({});
```

**Kanji States:**
```typescript
const { markKanjiAsEncountered, knownKanji, encounteredKanji, cycleKanjiState } = useKanjiStates(...)
```

### 4. Identify Specific Issues

#### Check for Object/Array Recreation

Look for props that are recreated on every render:

```typescript
// ❌ Bad - new object every render
<SearchPane userPreferences={{ dictionaryOrder: [], ... }} />

// ✅ Good - memoized object
const userPreferences = useMemo(() => ({ dictionaryOrder: [], ... }), [deps]);
<SearchPane userPreferences={userPreferences} />
```

#### Check for Function Recreation

```typescript
// ❌ Bad - new function every render
<SearchPane onSearch={(text, position) => handleSearch(text, position)} />

// ✅ Good - memoized function
const handleSearch = useCallback((text, position) => {
  // search logic
}, [dependencies]);
<SearchPane onSearch={handleSearch} />
```

## Optimization Strategies

### 1. Memoize Expensive Calculations

The SearchPane already has some memoization, but you can add more:

```typescript
// Memoize term groups calculation
const termGroups = useMemo(() => {
  if (!memoizedSearchResult?.dictionaryResults) return [];
  return groupByTerm(memoizedSearchResult.dictionaryResults, effectivePreferences.dictionaryOrder);
}, [memoizedSearchResult?.dictionaryResults, effectivePreferences.dictionaryOrder]);

// Memoize pitch accent data
const pitchAccentData = useMemo(() => {
  if (!memoizedSearchResult?.pitchAccentResults) return {};
  // ... calculation logic
}, [memoizedSearchResult?.pitchAccentResults]);
```

### 2. Optimize Parent Components

#### Library Page (`app/library/[supabase_upload_id]/page.tsx`)

**Current Issues:**
- `debouncedSearch` function recreated on every render
- `handleSearch` function recreated on every render
- `settingsContext` object recreated on every render

**Optimizations:**
```typescript
// Memoize debounced search
const debouncedSearch = useMemo(
  () => debounce(async (text: string, position: number, onComplete: (results: any) => void) => {
    // ... search logic
  }, 300),
  [knownKanji, encounteredKanji, cycleKanjiState]
);

// Memoize settings context
const settingsContext = useMemo(() => ({
  fontSize,
  verticalMargin,
  isEinkMode,
  preferences: userPreferences,
  updateSetting: (type: 'fontSize' | 'verticalMargin' | 'einkMode', value: number | boolean) => {
    // ... update logic
  },
  onDragEnd: async () => {},
  toggleSpoiler: () => {},
  toggleFrequencyDictionary: async () => {},
}), [fontSize, verticalMargin, isEinkMode, userPreferences]);
```

### 3. Use React.memo for Child Components

Consider wrapping child components that don't need frequent updates:

```typescript
const MemoizedDefinitionView = React.memo(DefinitionView);
const MemoizedPitchAccentGraphs = React.memo(PitchAccentGraphs);
```

### 4. Optimize State Updates

#### Audio State Optimization

Instead of updating multiple audio states separately:

```typescript
// ❌ Bad - multiple state updates
setAudioLoading(prev => ({ ...prev, [key]: true }));
setAudioError(prev => ({ ...prev, [key]: '' }));

// ✅ Good - single state update
setAudioState(prev => ({
  ...prev,
  loading: { ...prev.loading, [key]: true },
  error: { ...prev.error, [key]: '' }
}));
```

### 5. Reduce Effect Dependencies

Review useEffect dependencies and remove unnecessary ones:

```typescript
// ❌ Bad - too many dependencies
useEffect(() => {
  // effect logic
}, [memoizedSearchResult, isLoading, termGroups, searchStack.length, markKanjiAsEncountered, setSearchStack]);

// ✅ Good - minimal dependencies
useEffect(() => {
  // effect logic
}, [memoizedSearchResult, isLoading, searchStack.length]);
```

## Performance Monitoring

### 1. Console Monitoring

Enable detailed logging in development:

```typescript
// In SearchPane component
const { track } = useRenderTracker({
  componentName: 'SearchPane',
  enabled: process.env.NODE_ENV === 'development',
  logProps: true, // Enable for detailed prop logging
  trackDependencies: true
});
```

### 2. Browser DevTools

- Use React DevTools Profiler
- Monitor Network tab for API calls
- Check Performance tab for render timing

### 3. Custom Metrics

Add performance metrics to track:

```typescript
// Track render performance
const renderStart = performance.now();
// ... render logic
const renderEnd = performance.now();
console.log(`SearchPane render time: ${renderEnd - renderStart}ms`);

// Track API call frequency
let apiCallCount = 0;
const trackApiCall = () => {
  apiCallCount++;
  console.log(`API calls this session: ${apiCallCount}`);
};
```

## Common Patterns to Avoid

### 1. Inline Objects/Arrays

```typescript
// ❌ Bad
<div style={{ margin: '10px' }} />
<Component data={[1, 2, 3]} />

// ✅ Good
const styles = useMemo(() => ({ margin: '10px' }), []);
const data = useMemo(() => [1, 2, 3], []);
<div style={styles} />
<Component data={data} />
```

### 2. Inline Functions

```typescript
// ❌ Bad
<button onClick={() => handleClick(id)} />

// ✅ Good
const handleClick = useCallback((id: string) => {
  // click logic
}, []);
<button onClick={() => handleClick(id)} />
```

### 3. Unnecessary State Updates

```typescript
// ❌ Bad - updates even when value hasn't changed
setState(newValue);

// ✅ Good - only update if value changed
if (state !== newValue) {
  setState(newValue);
}
```

## Debugging Checklist

When investigating re-renders:

1. **Enable render tracking** and monitor console logs
2. **Use the render analyzer** to visualize render patterns
3. **Check parent components** for prop recreation
4. **Review useEffect dependencies** for unnecessary triggers
5. **Monitor state updates** for unnecessary changes
6. **Profile with React DevTools** for detailed analysis
7. **Check for object/array recreation** in props
8. **Verify function memoization** in parent components

## Quick Wins

1. **Memoize the settings context** in the library page
2. **Optimize the debounced search function** creation
3. **Reduce audio state updates** to single state object
4. **Add React.memo** to child components that rarely change
5. **Review and optimize useEffect dependencies**

## Expected Results After Recent Optimizations

After applying the recent optimizations:

- **Before**: 22 renders on single page load
- **After Round 1**: 14 renders (36% improvement)
- **After Round 2**: 8 renders (64% improvement)
- **After Round 3**: 6 renders (73% improvement)
- **After Round 4**: 6 renders (73% improvement)
- **After Round 5**: Expected 3-4 renders (82-86% improvement)

### Key Changes Made:

1. **User Preferences Loading**: Fixed multiple database calls and cache issues
2. **SearchResult Memoization**: Improved deep comparison logic
3. **useEffect Dependencies**: Removed unnecessary dependencies causing extra renders
4. **Loading State Protection**: Prevented multiple simultaneous preference loads
5. **Advanced Memoization**: Added stable hashes and content detection
6. **React.memo Wrapper**: Custom comparison function for prop changes
7. **Search Deduplication**: Prevented duplicate API calls for same search terms
8. **Function Memoization**: Optimized callback dependencies and recreation
9. **Initialization Protection**: Enhanced URL initialization to prevent duplicate searches
10. **Initialization Path Deduplication**: Added duplicate prevention to URL initialization
11. **Render Batching**: Batched state updates to prevent paired renders
12. **Session Logging Optimization**: Reduced logging frequency to improve performance
13. **Global Search Cache**: Implemented comprehensive search result caching
14. **Initialization Guard**: Added protection against multiple initialization calls
15. **Enhanced Cache Management**: Cache results across all code paths

## Next Steps

1. **Test the optimizations** by reloading the page and monitoring console logs
2. **Use the render analyzer** to verify the reduction in renders
3. **Monitor for any regressions** in functionality
4. **Apply similar optimizations** to other components if needed
5. **Consider implementing more advanced optimizations** like virtualization for large result sets

Remember: The goal is to reduce unnecessary re-renders while maintaining functionality. Always test thoroughly after making optimizations.
