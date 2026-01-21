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

        // Capture console.error - OPTIONAL: Disable this if it's too noisy
        // const originalError = console.error;
        // console.error = (...args) => {
        //    // Check if the first argument is an Event
        //    const msg = args.map(a => {
        //        if (a instanceof Event) return `[Event: ${a.type} on ${a.target}]`;
        //        if (a instanceof Error) return `[Error: ${a.message}]`;
        //        return String(a);
        //    }).join(' ');
        //    // originalError.apply(console, args);
        // };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleRejection);

        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleRejection);
        };
    }, []);

    return null;
}
