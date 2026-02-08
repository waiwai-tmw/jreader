# Authentication Error Handling Test Suite

This directory contains comprehensive unit and integration tests for the authentication error handling system in the JReader extension.

## Test Structure

### Core Test Files

1. **`authErrorHandling.test.ts`** - Tests for the core `AuthErrorHandler` class
2. **`sessionValidation.test.ts`** - Tests for session validation logic
3. **`authNotificationHandler.test.ts`** - Tests for the notification system
4. **`authErrorHandlingIntegration.test.ts`** - End-to-end integration tests

### Supporting Files

- **`test-setup.ts`** - Global test configuration and mocks
- **`runAuthErrorTests.ts`** - Test runner and helper utilities
- **`README.md`** - This documentation file

## Test Coverage

### AuthErrorHandler Core Functionality

- ✅ **Error Detection**
  - Invalid refresh token errors
  - Missing session errors
  - JWT expiration errors
  - Network errors
  - Edge cases (null/undefined handling)

- ✅ **Session Management**
  - Clearing authentication data
  - Error handling during cleanup
  - Storage API interactions

- ✅ **Retry Logic**
  - Exponential backoff
  - Maximum retry attempts
  - Session invalid error handling (no retry)
  - Success after retries

- ✅ **Error Handling**
  - Session invalid error handling
  - Retryable error handling
  - User-friendly error messages
  - Context logging

### Session Validation

- ✅ **Field Validation**
  - Required fields (access_token, refresh_token)
  - Empty string detection
  - Whitespace-only token detection

- ✅ **Time Validation**
  - Expiration time checking (24-hour tolerance)
  - Creation time checking (30-day limit)
  - Edge cases (exactly at limits)

- ✅ **Data Integrity**
  - Malformed session objects
  - Invalid date strings
  - Additional field handling
  - Real-world Supabase session structure

### Notification System

- ✅ **Notification Creation**
  - Different notification types (error, warning, info, success)
  - Browser notification creation
  - Permission checking
  - Storage management

- ✅ **Action Handling**
  - Sign in action (opens web app)
  - Retry action (retries last operation)
  - Start pairing action (initiates pairing)
  - Custom action callbacks

- ✅ **Storage Management**
  - Notification persistence
  - Maximum notification limits (5)
  - Notification ordering (newest first)
  - Error handling during storage

### Integration Tests

- ✅ **Complete Error Flows**
  - Invalid refresh token → Clear session → Show notification
  - Network error → Retry → Success
  - Missing session → Clear session → Show notification
  - JWT expiration → Clear session → Show notification

- ✅ **Session Validation Integration**
  - Invalid session detection before operations
  - Valid session acceptance
  - Startup sequence validation

- ✅ **Notification Flow Integration**
  - Different notifications for different error types
  - Storage limit management
  - Browser notification integration

- ✅ **Recovery Actions Integration**
  - Sign in action execution
  - Retry action execution
  - Start pairing action execution

## Running Tests

### Prerequisites

Ensure you have the following installed:
- Node.js (v16 or higher)
- npm or yarn
- Vitest test runner

### Installation

```bash
# Install dependencies
npm install

# Install test dependencies
npm install --save-dev vitest @vitest/ui
```

### Running All Tests

```bash
# Run all authentication error handling tests
npm test

# Run with coverage
npm run test:coverage

# Run with UI
npm run test:ui
```

### Running Specific Test Files

```bash
# Run only core error handling tests
npx vitest authErrorHandling.test.ts

# Run only session validation tests
npx vitest sessionValidation.test.ts

# Run only notification tests
npx vitest authNotificationHandler.test.ts

# Run only integration tests
npx vitest authErrorHandlingIntegration.test.ts
```

### Running Specific Test Suites

```bash
# Run only error detection tests
npx vitest --grep "isAuthError"

# Run only session validation tests
npx vitest --grep "validateStoredSession"

# Run only notification tests
npx vitest --grep "showNotification"
```

## Test Configuration

### Mock Setup

The tests use comprehensive mocks for:

- **Browser APIs** - Storage, notifications, runtime, tabs, permissions
- **Console Methods** - Log, error, warn, info, debug
- **Date/Time** - Consistent timestamps for predictable testing
- **Global Objects** - Navigator, location, process.env

### Test Helpers

The test suite includes helper functions for:

- Creating mock Supabase errors
- Creating mock session objects
- Creating mock notifications
- Creating mock browser APIs
- Async operation waiting

## Test Scenarios

### Error Detection Scenarios

1. **Invalid Refresh Token**
   ```typescript
   const error = new Error('AuthApiError: Invalid Refresh Token: Already Used');
   expect(AuthErrorHandler.isAuthError(error)).toBe(true);
   ```

2. **Missing Session**
   ```typescript
   const error = new Error('AuthSessionMissingError: Auth session missing!');
   expect(AuthErrorHandler.isSessionInvalidError(error)).toBe(true);
   ```

3. **JWT Expiration**
   ```typescript
   const error = new Error('JWT expired');
   expect(AuthErrorHandler.isAuthError(error)).toBe(true);
   ```

### Session Validation Scenarios

1. **Valid Session**
   ```typescript
   const session = {
     access_token: 'valid_token',
     refresh_token: 'valid_refresh_token',
     expires_at: new Date(Date.now() + 3600000).toISOString()
   };
   expect(await validateStoredSession(session)).toEqual({ isValid: true });
   ```

2. **Missing Fields**
   ```typescript
   const session = { access_token: 'valid_token' }; // Missing refresh_token
   expect(await validateStoredSession(session)).toEqual({
     isValid: false,
     reason: 'Missing access_token or refresh_token'
   });
   ```

3. **Expired Session**
   ```typescript
   const session = {
     access_token: 'valid_token',
     refresh_token: 'valid_refresh_token',
     expires_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() // 25 hours ago
   };
   expect(await validateStoredSession(session)).toEqual({
     isValid: false,
     reason: 'Session expired more than 24 hours ago'
   });
   ```

### Integration Scenarios

1. **Complete Error Flow**
   ```typescript
   const result = await withAuthErrorHandling(
     () => Promise.reject(new Error('Invalid Refresh Token: Already Used')),
     'test_flow',
     { maxRetries: 1, clearSessionOnError: true }
   );
   
   expect(result.success).toBe(false);
   expect(result.error).toBe('Session expired. Please re-authenticate.');
   ```

2. **Retry with Success**
   ```typescript
   const flakyOperation = vi.fn()
     .mockRejectedValueOnce(new Error('Network error'))
     .mockResolvedValue('success');
   
   const result = await withAuthErrorHandling(flakyOperation, 'test_retry');
   expect(result.success).toBe(true);
   expect(result.data).toBe('success');
   ```

## Debugging Tests

### Common Issues

1. **Mock Not Working**
   - Ensure mocks are properly set up in `beforeEach`
   - Check that `vi.clearAllMocks()` is called
   - Verify mock implementations match expected behavior

2. **Async Test Failures**
   - Use `await` for async operations
   - Check that promises are properly resolved/rejected
   - Use `vi.waitFor()` for timing-dependent tests

3. **Storage Mock Issues**
   - Ensure storage mocks return promises
   - Check that mock implementations match browser API
   - Verify storage keys match expected values

### Debug Commands

```bash
# Run tests with verbose output
npx vitest --reporter=verbose

# Run tests with debug logging
DEBUG=* npx vitest

# Run single test with debug
npx vitest --run --reporter=verbose authErrorHandling.test.ts
```

## Contributing

When adding new tests:

1. **Follow naming conventions** - Use descriptive test names
2. **Group related tests** - Use `describe` blocks for organization
3. **Mock external dependencies** - Don't rely on real browser APIs
4. **Test edge cases** - Include null/undefined/empty value tests
5. **Document complex scenarios** - Add comments for complex test logic

### Test Template

```typescript
describe('Feature Name', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle normal case', async () => {
    // Arrange
    const input = 'test input';
    const expected = 'expected output';
    
    // Act
    const result = await functionUnderTest(input);
    
    // Assert
    expect(result).toBe(expected);
  });

  it('should handle edge case', async () => {
    // Test edge cases
  });

  it('should handle error case', async () => {
    // Test error scenarios
  });
});
```

## Coverage Goals

- **Statements**: 95%+
- **Branches**: 90%+
- **Functions**: 95%+
- **Lines**: 95%+

Current coverage can be viewed by running:
```bash
npm run test:coverage
```

## Continuous Integration

These tests are designed to run in CI environments:

- No external dependencies
- Deterministic results
- Fast execution
- Clear failure messages
- Comprehensive error reporting

The test suite should pass in any environment that supports Node.js and the Vitest test runner.
