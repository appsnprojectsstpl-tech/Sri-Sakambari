export interface ShareData {
    title: string;
    text: string;
    url: string;
}

// APK download URL from GitHub releases
const APK_DOWNLOAD_URL = 'https://github.com/appsnprojectsstpl-tech/Sri-Sakambari/releases/latest';

export async function shareApp(data: ShareData): Promise<{ success: boolean; method: string }> {
    try {
        // Try Web Share API (works on mobile and modern browsers)
        if (typeof navigator !== 'undefined' && navigator.share) {
            await navigator.share(data);
            return { success: true, method: 'web-share' };
        }

        // Fallback to clipboard
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            await navigator.clipboard.writeText(data.url);
            return { success: true, method: 'clipboard' };
        }

        // Final fallback: create temporary input and copy
        const textArea = document.createElement('textarea');
        textArea.value = data.url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        return { success: true, method: 'clipboard-fallback' };
    } catch (error) {
        console.error('Share failed:', error);

        // Final fallback: try clipboard again
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard) {
                await navigator.clipboard.writeText(data.url);
                return { success: true, method: 'clipboard-retry' };
            }
        } catch (clipboardError) {
            console.error('Clipboard fallback failed:', clipboardError);
        }

        return { success: false, method: 'failed' };
    }
}

export function getShareData(): ShareData {
    return {
        title: 'Sri Sakambari - Fresh Products Delivery',
        text: `Download Sri Sakambari app and get fresh products delivered to your doorstep!\n\nDownload APK: ${APK_DOWNLOAD_URL}\n\nOr visit our website:`,
        url: APK_DOWNLOAD_URL
    };
}
