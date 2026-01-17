'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/firebase';
import { useUser } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const auth = useAuth();
    const { user, loading } = useUser(); // Custom hook that checks Firestore
    const router = useRouter();
    const pathname = usePathname();
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        if (loading) return;

        // Give Auth a moment to settle if needed, but 'loading' from useUser should cover it.
        // We need to check:
        // 1. Is Firebase Auth verified? (auth.currentUser)
        // 2. Does Firestore Profile exist? (user)

        if (auth?.currentUser) {
            // User is authenticated
            if (user) {
                // Profile exists - All good
                if (pathname === '/login' || pathname === '/signup') {
                    // Prevent logged-in users from seeing login/signup pages
                    router.replace('/dashboard');
                }
            } else {
                // Auth exists, but Profile is missing! (Ghost User)
                // Force redirection to registration
                // Exception: Don't redirect if already on login or signup page
                if (pathname !== '/login' && pathname !== '/signup') {
                    console.warn("AuthGuard: Ghost User detected. Redirecting to registration.");
                    router.replace('/login');
                    // Note: Login page handles the "Show Registration" state based on user check too.
                }
            }
        }

        setIsChecking(false);
    }, [auth, user, loading, pathname, router]);

    // While checking, show nothing (or a spinner/splash)
    if (isChecking || loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    // If we passed checks, render children
    return <>{children}</>;
}
