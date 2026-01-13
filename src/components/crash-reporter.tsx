'use client';

import { useEffect } from 'react';

export default function CrashReporter() {
    useEffect(() => {
        const handleError = (event: ErrorEvent) => {
            alert(`CRASH: ${event.message}\n${event.filename}:${event.lineno}`);
        };

        const handleRejection = (event: PromiseRejectionEvent) => {
            alert(`PROMISE FAIL: ${event.reason}`);
        };

        // Capture console.error
        const originalError = console.error;
        console.error = (...args) => {
            alert(`CONSOLE HEADER: ${args.map(a => String(a)).join(' ')}`);
            originalError.apply(console, args);
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleRejection);

        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleRejection);
        };
    }, []);

    return null;
}
