/**
 * Test setup file for Vitest
 * Configures global test environment and mocks
 */

import '@testing-library/jest-dom';
import { vi, beforeEach, afterEach } from 'vitest';
import React from 'react';

// Mock Firebase
vi.mock('@/firebase', () => ({
  useAuth: vi.fn(() => ({
    currentUser: { uid: 'test-user-id', email: 'test@example.com' },
    signInWithEmailAndPassword: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn((callback) => {
      callback({ uid: 'test-user-id', email: 'test@example.com' });
      return () => {};
    })
  })),
  
  useFirestore: vi.fn(() => ({})),
  
  useCollection: vi.fn(() => ({
    data: [],
    loading: false,
    error: null,
    refetch: vi.fn()
  })),
  
  firestore: {}
}));

// Mock Firebase Auth
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: { uid: 'test-user-id', email: 'test@example.com' }
  })),
  onAuthStateChanged: vi.fn((auth, callback) => {
    callback({ uid: 'test-user-id', email: 'test@example.com' });
    return () => {};
  }),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn()
}));

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(() => 'mock-timestamp'),
  increment: vi.fn((value) => value),
  arrayUnion: vi.fn((value) => value),
  arrayRemove: vi.fn((value) => value)
}));

// Mock Firebase Storage
vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(() => ({})),
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(() => Promise.resolve('mock-url'))
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    pathname: '/',
    query: {},
    asPath: '/'
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => '/'),
  redirect: vi.fn()
}));

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return React.createElement('img', { src, alt, ...props });
  }
}));

// Mock toast notifications
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn()
  }))
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

// Mock window.scrollTo
global.scrollTo = vi.fn();

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args: any[]) => {
  // Filter out expected React warnings in tests
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Warning: ReactDOM.render is no longer supported') ||
     args[0].includes('Warning: `ReactDOMTestUtils.act`') ||
     args[0].includes('Warning: An update to') ||
     args[0].includes('act(...)'))
  ) {
    return;
  }
  originalConsoleError(...args);
};

console.warn = (...args: any[]) => {
  // Filter out expected warnings in tests
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('componentWillReceiveProps has been renamed') ||
     args[0].includes('componentWillMount has been renamed') ||
     args[0].includes('componentWillUpdate has been renamed'))
  ) {
    return;
  }
  originalConsoleWarn(...args);
};

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

// Cleanup after tests
afterEach(() => {
  // Clean up any remaining timers
  vi.clearAllTimers();
});