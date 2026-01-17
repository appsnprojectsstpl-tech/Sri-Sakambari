'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { X } from 'lucide-react';

export default function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handler = (e: any) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            // Update UI notify the user they can install the PWA
            setIsVisible(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        // Show the install prompt
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        // We've used the prompt, and can't use it again, throw it away
        setDeferredPrompt(null);
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom duration-500">
            <div className="bg-[#1f1f1f] text-white p-4 rounded-xl shadow-2xl border border-white/10 flex items-center justify-between gap-4">
                <div className="flex flex-col">
                    <span className="font-bold text-base">Install App</span>
                    <span className="text-xs text-gray-400">Add to home screen for faster access</span>
                </div>
                <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-full hover:bg-white/10" onClick={() => setIsVisible(false)}>
                        <X className="w-5 h-5 text-gray-400" />
                    </Button>
                    <Button size="sm" onClick={handleInstallClick} className="bg-primary text-white hover:bg-primary/90 rounded-full px-4 h-8 text-xs font-bold">
                        <Download className="w-3 h-3 mr-2" />
                        Install
                    </Button>
                </div>
            </div>
        </div>
    );
}
