'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Download, CheckCircle2, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

import packageJson from '../../../package.json';

const CURRENT_VERSION = packageJson.version;
const GITHUB_REPO = 'appsnprojectsstpl-tech/Sri-Sakambari'; // Update with actual repo

interface UpdateInfo {
    available: boolean;
    latestVersion: string;
    downloadUrl?: string;
    releaseNotes?: string;
}

export default function UpdateChecker() {
    const [checking, setChecking] = useState(false);
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

    const checkForUpdates = async () => {
        setChecking(true);
        try {
            // Check GitHub releases API
            const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
            if (response.ok) {
                const data = await response.json();
                const latestVersion = data.tag_name.replace('v', '');

                setUpdateInfo({
                    available: latestVersion !== CURRENT_VERSION,
                    latestVersion,
                    downloadUrl: data.assets[0]?.browser_download_url,
                    releaseNotes: data.body
                });
            }
        } catch (error) {
            console.error('Failed to check for updates:', error);
        } finally {
            setChecking(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5" />
                    App Updates
                </CardTitle>
                <CardDescription>Check for the latest version</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium">Current Version</p>
                        <p className="text-2xl font-bold">{CURRENT_VERSION}</p>
                    </div>
                    <Button
                        onClick={checkForUpdates}
                        disabled={checking}
                        variant="outline"
                    >
                        {checking ? (
                            <>
                                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                Checking...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Check for Updates
                            </>
                        )}
                    </Button>
                </div>

                {updateInfo && (
                    <div className={`p-4 rounded-lg border ${updateInfo.available
                        ? 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800'
                        : 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
                        }`}>
                        {updateInfo.available ? (
                            <>
                                <div className="flex items-center gap-2 mb-2">
                                    <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                    <p className="font-semibold text-blue-900 dark:text-blue-100">
                                        Update Available!
                                    </p>
                                </div>
                                <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                                    Version {updateInfo.latestVersion} is now available
                                </p>
                                {updateInfo.downloadUrl && (
                                    <Button
                                        size="sm"
                                        onClick={() => window.open(updateInfo.downloadUrl, '_blank')}
                                        className="w-full"
                                    >
                                        <Download className="mr-2 h-4 w-4" />
                                        Download Update
                                    </Button>
                                )}
                            </>
                        ) : (
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                <p className="font-semibold text-green-900 dark:text-green-100">
                                    You're up to date!
                                </p>
                            </div>
                        )}
                    </div>
                )}

                <div className="text-xs text-muted-foreground space-y-1">
                    <p>• Last checked: {new Date().toLocaleString()}</p>
                    <p>• Build: Production</p>
                </div>
            </CardContent>
        </Card>
    );
}
