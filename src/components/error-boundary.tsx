'use client';

import React, { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
                    <div className="flex flex-col items-center gap-4 max-w-md">
                        <div className="p-4 bg-destructive/10 rounded-full">
                            <AlertTriangle className="h-12 w-12 text-destructive" />
                        </div>
                        <h2 className="text-2xl font-bold">Something went wrong</h2>
                        <p className="text-muted-foreground">
                            We encountered an unexpected error. Please try refreshing the page.
                        </p>
                        {this.state.error && (
                            <details className="text-xs text-left w-full p-3 bg-muted rounded-lg">
                                <summary className="cursor-pointer font-medium mb-2">Error details</summary>
                                <code className="text-[10px] break-all">{this.state.error.message}</code>
                            </details>
                        )}
                        <div className="flex gap-3">
                            <Button
                                onClick={() => window.location.reload()}
                                variant="default"
                            >
                                Refresh Page
                            </Button>
                            <Button
                                onClick={() => this.setState({ hasError: false, error: undefined })}
                                variant="outline"
                            >
                                Try Again
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
