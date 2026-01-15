/**
 * Production-safe logger
 * Suppresses console output in production builds
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
    error: (...args: any[]) => {
        if (isDevelopment) {
            console.error(...args);
        }
    },

    warn: (...args: any[]) => {
        if (isDevelopment) {
            console.warn(...args);
        }
    },

    log: (...args: any[]) => {
        if (isDevelopment) {
            console.log(...args);
        }
    },

    info: (...args: any[]) => {
        if (isDevelopment) {
            console.info(...args);
        }
    }
};

/**
 * Safe localStorage wrapper
 * Handles errors gracefully in production
 */
export const safeLocalStorage = {
    getItem: (key: string): string | null => {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            logger.error('localStorage.getItem error:', e);
            return null;
        }
    },

    setItem: (key: string, value: string): boolean => {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            logger.error('localStorage.setItem error:', e);
            return false;
        }
    },

    removeItem: (key: string): boolean => {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            logger.error('localStorage.removeItem error:', e);
            return false;
        }
    },

    clear: (): boolean => {
        try {
            localStorage.clear();
            return true;
        } catch (e) {
            logger.error('localStorage.clear error:', e);
            return false;
        }
    }
};

/**
 * Get Firebase error message
 * Converts Firebase error codes to user-friendly messages
 */
export const getFirebaseErrorMessage = (error: any): string => {
    if (!error) return 'An unknown error occurred';

    const code = error.code || '';

    switch (code) {
        case 'permission-denied':
            return 'Access denied. Please log in again.';
        case 'unavailable':
            return 'Network error. Please check your internet connection.';
        case 'failed-precondition':
            return 'Database configuration error. Please try again later.';
        case 'not-found':
            return 'The requested data was not found.';
        case 'already-exists':
            return 'This item already exists.';
        case 'unauthenticated':
            return 'Please log in to continue.';
        case 'deadline-exceeded':
            return 'Request timed out. Please try again.';
        case 'resource-exhausted':
            return 'Too many requests. Please try again later.';
        default:
            return error.message || 'Failed to load data. Please try again.';
    }
};
