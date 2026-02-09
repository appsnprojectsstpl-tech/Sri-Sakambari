'use client';

import { useEffect, useState } from 'react';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { SplashScreen } from '@capacitor/splash-screen';
import { App } from '@capacitor/app';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Download, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function CapacitorUpdaterComponent() {
    const [downloadStatus, setDownloadStatus] = useState<'idle' | 'downloading' | 'ready'>('idle');
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        // 1. Notify native side that the app bundle has loaded successfully.
        // This tells Capgo NOT to roll back to the previous version.
        CapacitorUpdater.notifyAppReady();

        // 2. Listen for download progress
        // @ts-ignore
        const progressListener = CapacitorUpdater.addListener('download', (info: any) => {
            setDownloadStatus('downloading');
            setProgress(parseInt(info.percent));
            console.log('download', info.percent);
        });

        // 3. Listen for update readiness
        // @ts-ignore
        const updateListener = CapacitorUpdater.addListener('updateAvailable', (info: any) => {
            setDownloadStatus('ready');
        });

        return () => {
            progressListener.remove();
            updateListener.remove();
        };
    }, []);

    const handleReload = async () => {
        try {
            await SplashScreen.show();
            await CapacitorUpdater.reload();
        } catch (e) {
            console.error('Failed to reload', e);
            // Fallback: Restart app
            // App.exitApp();
        }
    };

    if (downloadStatus === 'idle') return null;

    return (
        <Dialog open={true}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Update Available</DialogTitle>
                    <DialogDescription>
                        {downloadStatus === 'downloading' ? (
                            'Downloading new version in the background...'
                        ) : (
                            'A new version is ready to install!'
                        )}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col items-center justify-center py-4">
                    {downloadStatus === 'downloading' ? (
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <span className="text-sm font-medium">{progress}%</span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2 text-green-600">
                            <RefreshCw className="w-10 h-10" />
                            <span className="font-bold">Update Ready</span>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    {downloadStatus === 'ready' && (
                        <Button onClick={handleReload} className="w-full">
                            Install & Restart
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
