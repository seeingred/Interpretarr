import { vi } from 'vitest';

// Mock environment variables
process.env.NODE_ENV = 'test';

// Global mocks that are commonly needed
global.fetch = vi.fn();

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

// Reset mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Don't use fake timers globally as some tests need real timers