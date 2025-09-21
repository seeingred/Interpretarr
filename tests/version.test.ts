import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// Mock dependencies
vi.mock('fs');
vi.mock('url');
vi.mock('path', () => ({
  default: {
    dirname: vi.fn(),
    join: vi.fn(),
  },
  dirname: vi.fn(),
  join: vi.fn(),
}));

describe('Version Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    // Mock file system to return a fake package.json
    (readFileSync as Mock).mockReturnValue(JSON.stringify({
      name: 'interpretarr',
      version: '1.0.2',
      description: 'Test package'
    }));

    // Mock path operations
    (fileURLToPath as Mock).mockReturnValue('/mocked/src/version.js');
    (path.dirname as Mock).mockReturnValue('/mocked/src');
    (path.join as Mock).mockImplementation((...args: string[]) => {
      return args.join('/');
    });
  });

  it('should export APP_VERSION from package.json', async () => {
    const versionModule = await import('../src/version');

    expect(versionModule.APP_VERSION).toBe('1.0.2');
  });

  it('should read package.json from correct path', async () => {
    await import('../src/version');

    expect(fileURLToPath).toHaveBeenCalled();
    expect(path.dirname).toHaveBeenCalledWith('/mocked/src/version.js');
    expect(path.join).toHaveBeenCalledWith('/mocked/src', '..', 'package.json');
    expect(readFileSync).toHaveBeenCalledWith('/mocked/src/../package.json', 'utf-8');
  });

  it('should handle different version numbers', async () => {
    (readFileSync as Mock).mockReturnValue(JSON.stringify({
      name: 'interpretarr',
      version: '2.5.10',
      description: 'Test package'
    }));

    vi.resetModules();
    const versionModule = await import('../src/version');

    expect(versionModule.APP_VERSION).toBe('2.5.10');
  });

  it('should handle version with pre-release tags', async () => {
    (readFileSync as Mock).mockReturnValue(JSON.stringify({
      name: 'interpretarr',
      version: '1.0.0-beta.1',
      description: 'Test package'
    }));

    vi.resetModules();
    const versionModule = await import('../src/version');

    expect(versionModule.APP_VERSION).toBe('1.0.0-beta.1');
  });

  it('should throw error if package.json is invalid JSON', async () => {
    (readFileSync as Mock).mockReturnValue('invalid json');

    await expect(import('../src/version')).rejects.toThrow();
  });

  it('should throw error if package.json cannot be read', async () => {
    (readFileSync as Mock).mockImplementation(() => {
      throw new Error('File not found');
    });

    await expect(import('../src/version')).rejects.toThrow('File not found');
  });

  it('should handle package.json without version field', async () => {
    (readFileSync as Mock).mockReturnValue(JSON.stringify({
      name: 'interpretarr',
      description: 'Test package'
    }));

    vi.resetModules();
    const versionModule = await import('../src/version');

    expect(versionModule.APP_VERSION).toBeUndefined();
  });
});