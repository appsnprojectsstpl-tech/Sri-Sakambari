'use client';

import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Download, Sparkles } from 'lucide-react';

interface UpdateInfo {
    latestVersion: string;
    versionCode: number;
    downloadUrl: string;
    releaseNotes: string;
    forceUpdate: boolean;
}

export function UpdateChecker() {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [downloading, setDownloading] = useState(false);
    const [checkingUpdate, setCheckingUpdate] = useState(false);

    // Current version from build environment
    const currentVersion = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0';
    const currentVersionCode = Number(process.env.NEXT_PUBLIC_VERSION_CODE || 0);

    useEffect(() => {
        // Check for updates when app starts
        checkForUpdates();

        // Check again every 6 hours
        const interval = setInterval(checkForUpdates, 6 * 60 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    async function checkForUpdates() {
        setCheckingUpdate(true);
        try {
            // Fetch version info from GitHub Raw
            const response = await fetch(
                'https://raw.githubusercontent.com/appsnprojectsstpl-tech/Sri-Sakambari/main/version.json',
                { cache: 'no-store' }
            );

            if (!response.ok) {
                console.log('No version file found, skipping update check');
                return;
            }

            const data: UpdateInfo = await response.json();

            // DEBUG: Show what we found
            // console.log(`Update Check: Local ${currentVersionCode} vs Remote ${data.versionCode}`);


            // Compare version codes
            // data.versionCode comes from version.json (which comes from build.gradle)
            // currentVersionCode comes from process.env.NEXT_PUBLIC_VERSION_CODE
            if (data.versionCode > currentVersionCode) {
                setUpdateInfo(data);
                setUpdateAvailable(true);
            } else {
                console.log('App is up to date.');
                alert(`App is up to date (v${currentVersionCode})`);
            }
        } catch (error) {
            console.log('Update check failed:', error);
        } finally {
            setCheckingUpdate(false);
        }
    }

    async function handleUpdate() {
        if (!updateInfo) return;

        setDownloading(true);

        try {
            // Open download URL in browser
            // This will download the APK file
            window.open(updateInfo.downloadUrl, '_blank');

            // Show success message
            setTimeout(() => {
                alert('Download started! Please install the APK when download completes.');
                setUpdateAvailable(false);
            }, 1000);
        } catch (error) {
            console.error('Failed to download update:', error);
            alert('Failed to start download. Please try again.');
        } finally {
            setDownloading(false);
        }
    }

    function handleLater() {
        if (updateInfo?.forceUpdate) {
            alert('This update is required to continue using the app.');
            return;
        }
        setUpdateAvailable(false);
    }

    if (!updateAvailable || !updateInfo) return null;

    return (
        <Dialog
            open={updateAvailable}
            onOpenChange={(open) => {
                if (!open && !updateInfo.forceUpdate) {
                    setUpdateAvailable(false);
                }
            }}
        >
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-6 w-6 text-primary" />
                        <DialogTitle className="text-xl">Update Available!</DialogTitle>
                    </div>
                    <DialogDescription>
                        Version {updateInfo.latestVersion} is now available.
                        {updateInfo.forceUpdate && (
                            <span className="block mt-2 text-destructive font-semibold">
                                This update is required to continue.
                            </span>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-4">
                    <div>
                        <p className="text-sm font-semibold mb-2">What's New:</p>
                        <div className="bg-muted p-3 rounded-md">
                            <p className="text-sm whitespace-pre-line">
                                {updateInfo.releaseNotes}
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Current: v{currentVersion}</span>
                        <span>New: v{updateInfo.latestVersion}</span>
                    </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    {!updateInfo.forceUpdate && (
                        <Button
                            variant="outline"
                            onClick={handleLater}
                            className="w-full sm:w-auto"
                        >
                            Later
                        </Button>
                    )}
                    <Button
                        onClick={handleUpdate}
                        disabled={downloading}
                        className="w-full sm:w-auto"
                    >
                        {downloading ? (
                            <>
                                <Download className="mr-2 h-4 w-4 animate-bounce" />
                                Downloading...
                            </>
                        ) : (
                            <>
                                <Download className="mr-2 h-4 w-4" />
                                Update Now
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
