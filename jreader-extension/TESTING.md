# Extension Testing Guide

This document describes the testing setup and strategy for the JReader extension.

## Test Framework

We use **Vitest** as our testing framework, which provides:
- Fast test execution
- Built-in TypeScript support
- Jest-compatible API
- Great developer experience

## Test Structure

### Unit Tests

#### Browser Utilities (`src/lib/__tests__/browser.test.ts`)
Tests the core browser detection and utility functions:
- **Browser Detection**: Tests `getBrowserInfo()` function for Chrome, Firefox, Safari, Edge, and unknown browsers
- **Feature Detection**: Tests API availability detection functions
- **Storage Helpers**: Tests storage utility functions

#### Content Script Functions (`src/__tests__/content-functions.test.ts`)
Tests utility functions used in the content script:
- **Origin Validation**: Tests allowed origin validation for security
- **Message Type Validation**: Tests valid message type checking
- **Card Data Validation**: Tests card data structure validation
- **Session Data Validation**: Tests Supabase session data validation
// Legacy nonce validation removed

#### Background Script Functions (`src/__tests__/background-functions.test.ts`)
Tests utility functions used in the background script:
- **Message Type Validation**: Tests valid background message types
- **Anki Settings Validation**: Tests Anki configuration validation
- **URL Validation**: Tests URL format validation
- **Error Response Formatting**: Tests error response structure
- **Success Response Formatting**: Tests success response structure
- **Storage Key Validation**: Tests storage key validation

### Integration Tests

#### Message Flow (`src/__tests__/message-flow.test.ts`)
Tests the complete message flow between components:
- **Web App to Content Script**: Tests message processing from web app
- **Content Script to Background**: Tests message forwarding to background script
- **Error Handling**: Tests error handling throughout the flow

#### Service Worker Auth Hydration (`src/__tests__/sw-auth-hydration.test.ts`)
Validates that the service worker rehydrates auth via `extensionAuth` before answering auth queries.

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode (Development)
```bash
npm run test:watch
```

### Test UI (Interactive)
```bash
npm run test:ui
```

### Coverage Report
```bash
npm run test:coverage
```

## Test Philosophy

### What We Test
1. **Utility Functions**: All pure functions that don't depend on browser APIs
2. **Data Validation**: Input validation and sanitization functions
3. **Message Flow Logic**: The logic for processing messages between components
4. **Configuration**: Manifest generation and configuration validation
5. **Error Handling**: Error formatting and handling logic

### What We Don't Test
1. **Browser API Calls**: We don't test actual browser API interactions (these are mocked)
2. **DOM Manipulation**: We don't test actual DOM operations
3. **Network Requests to external services**: We mock fetch for deterministic behavior
4. **Extension Lifecycle**: We don't test install/update UI flows

### Why This Approach
- **Fast**: Tests run quickly without browser dependencies
- **Reliable**: Tests don't flake due to browser state
- **Focused**: Tests focus on business logic, not implementation details
- **Maintainable**: Tests are easy to understand and maintain

## Test Data

### Valid Test Data Examples
```typescript
// Valid card data
const validCard = {
  id: 'card-123',
  expression: 'テスト',
  reading: 'テスト',
  definitions: 'test definition',
};

// Valid session data
const validSession = {
  access_token: 'test-token',
  refresh_token: 'refresh-token',
  user: {
    id: 'user-123',
    email: 'test@example.com',
  },
};

// Valid Anki settings
const validAnkiSettings = {
  anki_connect_url: 'http://localhost:8765',
  anki_deck: 'JReader',
  anki_note_type: 'Basic',
};
```

### Invalid Test Data Examples
```typescript
// Invalid card data
const invalidCard = {
  id: '', // Empty ID
  // Missing expression
};

// Invalid session data
const invalidSession = {
  access_token: '', // Empty token
  // Missing user
};

// Invalid Anki settings
const invalidAnkiSettings = {
  anki_connect_url: '', // Empty URL
  // Missing deck and note type
};
```

## Adding New Tests

### For New Utility Functions
1. Create the function in the appropriate module
2. Add tests in the corresponding test file
3. Test both valid and invalid inputs
4. Test edge cases

### For New Message Types
1. Add the message type to the validation functions
2. Add tests for the new message type
3. Test both success and error cases
4. Update the message flow tests

### For New Configuration Options
1. Add the configuration to the manifest generator
2. Add tests for the new configuration
3. Test both Chrome and Firefox variants
4. Test validation of the new options

## Debugging Tests

### Common Issues
1. **Async Tests**: Make sure to use `await` for async operations
2. **Mocking**: Ensure mocks are properly set up in `beforeEach`
3. **Data Types**: Check that test data matches expected types
4. **Assertions**: Use appropriate assertion methods for the data type

### Test Debugging Tips
1. Use `console.log` in tests to debug data flow
2. Use `expect.any()` for dynamic values
3. Use `toMatchObject()` for partial object matching
4. Use `toHaveBeenCalledWith()` for function call verification

## Continuous Integration

Tests are designed to run in CI environments:
- No browser dependencies
- No external network calls
- Deterministic results
- Fast execution

## Coverage Goals

- **Statements**: > 90%
- **Branches**: > 85%
- **Functions**: > 90%
- **Lines**: > 90%

Current coverage can be checked with:
```bash
npm run test:coverage
```

## Best Practices

1. **Test Behavior, Not Implementation**: Focus on what the function does, not how it does it
2. **Use Descriptive Test Names**: Test names should clearly describe what is being tested
3. **Test Edge Cases**: Include tests for boundary conditions and error cases
4. **Keep Tests Simple**: Each test should test one specific behavior
5. **Use Appropriate Assertions**: Choose the right assertion method for the data type
6. **Mock External Dependencies**: Don't test browser APIs, mock them instead
7. **Clean Up**: Use `beforeEach` and `afterEach` to set up and clean up test state
