export interface ShareData {
    title: string;
    text: string;
    url: string;
}

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
        title: 'Sri Sakambari',
        text: 'Browse fresh products and place orders easily!',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://studio-1474537647-7252f.web.app'
    };
}
