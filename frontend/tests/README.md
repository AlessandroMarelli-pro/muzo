# Frontend Testing Guide

This document describes the testing setup and guidelines for the Muzo frontend application.

## Testing Framework

We use **Vitest** as our primary testing framework, which provides:

- Fast test execution
- Built-in TypeScript support
- Jest-compatible API
- Coverage reporting
- UI mode for interactive testing

## Test Structure

```
frontend/tests/
├── setup.ts                    # Global test setup
├── contract/                   # Contract tests
│   └── component-contracts.test.ts
├── unit/                       # Unit tests
│   └── api-client.test.ts
└── integration/                # Integration tests
    └── component-integration.test.ts
```

## Test Types

### 1. Contract Tests (`tests/contract/`)

- **Purpose**: Validate component contracts and expected behavior
- **Scope**: Component rendering, props handling, user interactions
- **Examples**: Component renders correctly, buttons call callbacks, forms validate input

### 2. Unit Tests (`tests/unit/`)

- **Purpose**: Test individual functions and hooks in isolation
- **Scope**: API client, custom hooks, utility functions
- **Examples**: API client makes correct requests, hooks return expected data

### 3. Integration Tests (`tests/integration/`)

- **Purpose**: Test component interactions and workflows
- **Scope**: Multiple components working together, user workflows
- **Examples**: Dashboard view switching, library creation workflow

## Running Tests

### All Tests

```bash
npm run test              # Watch mode
npm run test:run          # Run once
npm run test:ui           # Interactive UI mode
```

### Specific Test Types

```bash
npm run test:contract     # Contract tests only
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests only
```

### Coverage

```bash
npm run test:coverage     # Run with coverage report
```

## Test Configuration

### Vitest Config (`vitest.config.ts`)

- **Environment**: jsdom for DOM testing
- **Setup**: Global test setup file
- **Aliases**: `@` maps to `src/` directory
- **CSS**: Enabled for component styling tests

### Test Setup (`tests/setup.ts`)

- **Jest DOM**: Custom matchers for DOM testing
- **Mocks**: IntersectionObserver, ResizeObserver, matchMedia
- **Fetch**: Mocked for API testing
- **Console**: Reduced noise in test output

## Testing Guidelines

### 1. Component Testing

```typescript
// Test component rendering
it('should render library information correctly', () => {
  render(<LibraryCard library={mockLibrary} />);
  expect(screen.getByText('Test Library')).toBeInTheDocument();
});

// Test user interactions
it('should call onScan when scan button is clicked', async () => {
  const user = userEvent.setup();
  const mockOnScan = vi.fn();

  render(<LibraryCard library={mockLibrary} onScan={mockOnScan} />);

  await user.click(screen.getByText('Scan'));
  expect(mockOnScan).toHaveBeenCalledWith('1');
});
```

### 2. Hook Testing

```typescript
// Test custom hooks with QueryClient
it('should fetch libraries successfully', async () => {
  const TestWrapper = createTestWrapper();
  const { result } = renderHook(() => useLibraries(), {
    wrapper: TestWrapper,
  });

  await waitFor(() => {
    expect(result.current.isSuccess).toBe(true);
  });
});
```

### 3. API Testing

```typescript
// Test API client
it('should make successful query requests', async () => {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(mockResponse),
  });

  const result = await apiClient.query(query);
  expect(result).toEqual(mockResponse);
});
```

## Mock Data

### Library Mock

```typescript
const mockLibrary: MusicLibrary = {
  id: '1',
  name: 'Test Library',
  rootPath: '/test/path',
  totalTracks: 100,
  analyzedTracks: 80,
  // ... other properties
};
```

### Track Mock

```typescript
const mockTrack: MusicTrack = {
  id: '1',
  filePath: '/test/path/track.mp3',
  fileName: 'track.mp3',
  duration: 180,
  format: 'MP3',
  // ... other properties
};
```

## Test Utilities

### QueryClient Wrapper

```typescript
const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};
```

### Mock Functions

```typescript
const mockOnScan = vi.fn();
const mockOnView = vi.fn();
const mockOnPlay = vi.fn();
```

## Coverage Requirements

- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

## Best Practices

### 1. Test Structure

- Use descriptive test names
- Group related tests with `describe` blocks
- Test one thing per test case
- Use `beforeEach` and `afterEach` for setup/cleanup

### 2. Assertions

- Use specific matchers (`toBeInTheDocument`, `toHaveBeenCalledWith`)
- Test both positive and negative cases
- Verify error handling

### 3. Mocking

- Mock external dependencies
- Use `vi.fn()` for function mocks
- Mock fetch for API testing
- Clean up mocks between tests

### 4. Async Testing

- Use `waitFor` for async operations
- Use `userEvent` for user interactions
- Test loading and error states

### 5. Accessibility

- Test ARIA labels and roles
- Test keyboard navigation
- Test screen reader compatibility

## Debugging Tests

### 1. Debug Mode

```bash
npm run test -- --reporter=verbose
```

### 2. UI Mode

```bash
npm run test:ui
```

### 3. Single Test

```bash
npm run test -- --run component-contracts.test.ts
```

### 4. Watch Mode

```bash
npm run test -- --watch
```

## Continuous Integration

Tests are automatically run in CI/CD pipelines:

- All tests must pass
- Coverage thresholds must be met
- No linting errors allowed

## Troubleshooting

### Common Issues

1. **Import Errors**: Check path aliases in `vitest.config.ts`
2. **Mock Issues**: Ensure mocks are properly set up in `tests/setup.ts`
3. **Async Issues**: Use `waitFor` for async operations
4. **DOM Issues**: Ensure jsdom environment is configured

### Getting Help

- Check Vitest documentation: https://vitest.dev/
- Check Testing Library documentation: https://testing-library.com/
- Review existing test files for examples
- Ask team members for assistance
