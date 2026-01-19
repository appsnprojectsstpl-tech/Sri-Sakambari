'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error);
    }, [error]);

    return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-6 text-center">
            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-red-50">
                <AlertTriangle className="h-12 w-12 text-destructive" />
            </div>
            <h2 className="mb-2 text-2xl font-bold tracking-tight text-foreground">Something went wrong!</h2>
            <p className="mb-6 text-muted-foreground">
                We apologize for the inconvenience. An unexpected error has occurred.
            </p>

            {/* Show technical details in development/debug builds effectively */}
            {process.env.NODE_ENV !== 'production' && (
                <div className="mb-6 w-full max-w-md rounded-lg bg-muted p-4 text-left font-mono text-xs text-muted-foreground overflow-auto max-h-40">
                    {error.message}
                    {error.digest && <div className="mt-2 text-xs">Digest: {error.digest}</div>}
                </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4">
                <Button onClick={reset} size="lg" className="gap-2">
                    <RefreshCcw className="h-4 w-4" />
                    Try Again
                </Button>
                <Button variant="outline" size="lg" className="gap-2" onClick={() => window.location.href = '/'}>
                    <Home className="h-4 w-4" />
                    Go Home
                </Button>
            </div>
        </div>
    );
}
