import '@testing-library/jest-dom';
import { vi } from 'vitest';

if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    });
  }

  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
}

if (!global.ResizeObserver) {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!global.URL) {
  global.URL = {};
}

if (!global.URL.createObjectURL) {
  global.URL.createObjectURL = vi.fn();
}

if (typeof import.meta === 'object' && import.meta) {
  if (!import.meta.env) {
    Object.defineProperty(import.meta, 'env', {
      value: {},
      writable: true
    });
  }

  Object.assign(import.meta.env, {
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api',
    VITE_API_TIMEOUT: import.meta.env.VITE_API_TIMEOUT || '30000',
    VITE_ENABLE_DEBUG_LOGS: import.meta.env.VITE_ENABLE_DEBUG_LOGS || 'false',
    VITE_ENV: import.meta.env.VITE_ENV || 'test',
    MODE: import.meta.env.MODE || 'test'
  });
}
